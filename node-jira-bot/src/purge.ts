import fs from 'fs';
import path from 'path';
import { JiraService } from './services/jira.service';
import { loadConfig } from './config/env';

async function purge() {
  const args = process.argv.slice(2);
  
  // El primer argumento sin flag es el nombre del proyecto
  // Flags: --all | -a
  const projectName = args.find(arg => arg !== '--all' && arg !== '-a') || null;
  const isPurgeAll = args.includes('--all') || args.includes('-a');
  
  // Filtramos los flags y el nombre del proyecto para quedarnos solo con las keys explícitas
  let keys = args.filter(arg => arg !== '--all' && arg !== '-a' && arg !== projectName);
  
  // Determinar directorio del proyecto
  const projectDir = projectName
    ? path.resolve(process.cwd(), 'projects', projectName)
    : process.cwd();
  const logPath = path.resolve(projectDir, 'created-issues.json');
  let loadedFromLog = false;

  console.log('======================================================================');
  console.log('🗑️  JIRA BULK PURGER — LIMPIADOR DE BACKLOG');
  if (projectName) {
    console.log(`📁 Proyecto: ${projectName}`);
  }
  console.log('======================================================================\n');

  // Cargar configuración y crear servicio
  const config = loadConfig(projectName || undefined);
  const jiraService = new JiraService(config);

  // Inicialización de conexión para validar credenciales y obtener usuario
  console.log('🔄 Validando credenciales de conexión con Jira Cloud...');
  let user;
  try {
    user = await jiraService.testConnection();
    console.log(`✅ ¡Conexión Establecida!`);
    console.log(`👤 Autorizado como: ${user.displayName} (${user.emailAddress})`);
    console.log(`🏢 Host: ${config.JIRA_HOST}`);
    console.log(`🔑 Proyecto Target: [${config.JIRA_PROJECT_KEY}]\n`);
    console.log('----------------------------------------------------------------------\n');
  } catch (error: any) {
    console.error(`❌ Fallo de conexión: ${error.message}`);
    process.exit(1);
  }

  // 1. Si se solicita --all, consultamos Jira para obtener todas las incidencias del proyecto
  if (isPurgeAll) {
    console.log(`⚠️  ALERTA NUCLEAR: Buscando ABSOLUTAMENTE TODAS las incidencias del proyecto [${config.JIRA_PROJECT_KEY}]...`);
    try {
      keys = await jiraService.getProjectIssueKeys();
      console.log(`📊 Encontradas [${keys.length}] incidencias totales en el proyecto.`);
    } catch (error: any) {
      console.error(`❌ Error al consultar las incidencias del proyecto: ${error.message}`);
      process.exit(1);
    }
  }

  // 2. Si no es --all y no hay keys explícitas, intentamos leer desde created-issues.json
  if (keys.length === 0 && !isPurgeAll) {
    if (fs.existsSync(logPath)) {
      try {
        const rawLog = fs.readFileSync(logPath, 'utf-8');
        keys = JSON.parse(rawLog);
        
        if (Array.isArray(keys) && keys.length > 0) {
          loadedFromLog = true;
          console.log(`📂 Detectado archivo de última ejecución. Cargando [${keys.length}] incidencias...`);
        }
      } catch (error: any) {
        console.error(`❌ Error al leer created-issues.json: ${error.message}`);
      }
    }
  }

  // 3. Validar si al final obtuvimos claves para borrar
  if (keys.length === 0) {
    console.error('❌ Error: No se especificaron claves ni se detectó actividad previa.');
    console.log('Uso de comandos:');
    if (projectName) {
      console.log(`  pnpm run purge ${projectName}             -> Borra lo creado en tu última ejecución del proyecto`);
      console.log(`  pnpm run purge ${projectName} KEY-1 KEY-2 -> Borra las incidencias específicas`);
      console.log(`  pnpm run purge ${projectName} --all       -> ⚠️  PURGA NUCLEAR del proyecto`);
    } else {
      console.log('  pnpm run purge                -> Borra lo creado en tu última ejecución automática');
      console.log('  pnpm run purge KEY-1 KEY-2    -> Borra las incidencias específicas ingresadas');
      console.log('  pnpm run purge --all          -> ⚠️  PURGA NUCLEAR: Borra absolutamente TODO en el proyecto');
    }
    console.log('\n======================================================================\n');
    process.exit(1);
  }

  console.log(`🗑️ Preparando la eliminación de [${keys.length}] incidencias...\n`);
  
  let successCount = 0;
  let failCount = 0;

  for (const key of keys) {
    const cleanKey = key.trim().toUpperCase();
    console.log(`🗑️ Eliminando incidencia: [ ${cleanKey} ]...`);
    try {
      await jiraService.deleteIssue(cleanKey);
      console.log(`   ✅ ¡Eliminada con éxito!`);
      successCount++;
    } catch (error: any) {
      // Manejo estético de la cascada de borrado en Jira (si un padre se borra, sus hijos dan 404 al intentar borrarlos después)
      if (error.message.includes('HTTP 404')) {
        console.log(`   ✅ ¡Ya no existe! (Eliminado previamente por cascada)`);
        successCount++;
      } else {
        console.error(`   ❌ Fallo al eliminar [ ${cleanKey} ]: ${error.message}`);
        failCount++;
      }
    }
    console.log(''); // Salto de línea estético
  }

  // Si las cargamos del log y se eliminaron con éxito, limpiamos el archivo de log para evitar re-eliminaciones accidentales
  if (loadedFromLog && failCount === 0) {
    try {
      fs.unlinkSync(logPath);
      console.log('🧹 Limpieza completada: Archivo created-issues.json eliminado.\n');
    } catch (error: any) {
      console.error(`⚠️ Advertencia: No se pudo eliminar el archivo temporal de logs: ${error.message}\n`);
    }
  }

  console.log('======================================================================');
  console.log('📊 RESUMEN DE LA PURGA');
  console.log('======================================================================');
  console.log(`🗑️ Incidencias eliminadas con éxito/cascada:  ${successCount}`);
  console.log(`❌ Incidencias fallidas:                     ${failCount}`);
  console.log('======================================================================\n');
}

purge();
