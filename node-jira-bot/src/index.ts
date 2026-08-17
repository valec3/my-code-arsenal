import fs from 'fs';
import path from 'path';
import { loadConfig } from './config/env';
import { JiraService } from './services/jira.service';
import { BacklogEpic } from './types/jira.types';

// ==============================================================================
// ORQUESTADOR PRINCIPAL - CASCADA DE APROVISIONAMIENTO MULTI-PROYECTO
// ==============================================================================
// Uso: pnpm run dev <proyecto> [archivo-backlog]
// Ejemplos:
//   pnpm run dev cgs                           # usa backlog.json
//   pnpm run dev cgs backlog-sprint-2.json      # usa archivo específico
//
// Cada proyecto vive en projects/<nombre>/ con:
//   - .env          (JIRA_PROJECT_KEY, tipos custom)
//   - backlog.json  (épicas, historias, tareas)
//   - backlog-*.json (lotes incrementales opcionales)
//
// Las credenciales comunes (HOST, EMAIL, TOKEN) van en el .env raíz.
// ==============================================================================

async function main() {
  // 1. Parsear nombre del proyecto y archivo de backlog desde CLI
  const args = process.argv.slice(2);
  const projectName = args[0] || null;
  const backlogFile = args[1] || 'backlog.json';

  console.clear();
  console.log('======================================================================');
  console.log('🚀 JIRA HIERARCHICAL PROVISIONER — CASCADA DE BACKLOG');
  if (projectName) {
    console.log(`📁 Proyecto: ${projectName}`);
  }
  console.log('======================================================================\n');

  // 2. Cargar configuración (raíz + proyecto específico)
  const config = loadConfig(projectName || undefined);
  const jiraService = new JiraService(config);

  // 3. Determinar directorio del proyecto
  const projectDir = projectName
    ? path.resolve(process.cwd(), 'projects', projectName)
    : process.cwd();

  // 4. Probar Conexión con Jira Cloud
  console.log('🔄 Validando credenciales de conexión con Jira Cloud...');
  try {
    const user = await jiraService.testConnection();
    console.log(`✅ ¡Conexión Establecida!`);
    console.log(`👤 Usuario: ${user.displayName}`);
    console.log(`📧 Email: ${user.emailAddress}`);
    console.log(`🏢 Host: ${config.JIRA_HOST}`);
    console.log(`🔑 Proyecto Destino: [${config.JIRA_PROJECT_KEY}]\n`);
  } catch (error: any) {
    console.error(`❌ Fallo de Conexión Crítico: ${error.message}`);
    process.exit(1);
  }

  // 5. Localizar y Cargar el Archivo de backlog
  const backlogPath = path.resolve(projectDir, backlogFile);
  
  if (!fs.existsSync(backlogPath)) {
    console.error('❌ Archivo de Backlog no encontrado.');
    console.error(`Buscado en la ruta: ${backlogPath}`);
    if (projectName) {
      console.error(`Creá el archivo en projects/${projectName}/backlog.json`);
    } else {
      console.error('Creá el archivo backlog.json en la raíz de node-jira-bot/ o usá: pnpm run dev <proyecto>');
    }
    process.exit(1);
  }

  console.log(`📂 Cargando backlog desde: ${backlogPath}...`);
  let backlog: BacklogEpic[] = [];

  try {
    const rawData = fs.readFileSync(backlogPath, 'utf-8');
    backlog = JSON.parse(rawData);
    
    if (!Array.isArray(backlog)) {
      if (typeof backlog === 'object' && backlog !== null) {
        backlog = [backlog];
      } else {
        throw new Error('El JSON de backlog debe representar una Épica o un listado de Épicas.');
      }
    }
  } catch (error: any) {
    console.error(`❌ Error al parsear backlog.json: ${error.message}`);
    console.error('Por favor, asegurate de que el archivo JSON tenga un formato de sintaxis válido.');
    process.exit(1);
  }

  console.log(`📊 Se cargaron [${backlog.length}] Épicas para procesar.`);
  console.log('----------------------------------------------------------------------\n');

  // 6. Estadísticas finales y registro de incidencias creadas para purga automática
  let epicsCreated = 0;
  let storiesCreated = 0;
  let tasksCreated = 0;
  const createdKeys: string[] = [];

  const createdIssuesPath = path.resolve(projectDir, 'created-issues.json');

  const saveCreatedKeys = () => {
    if (createdKeys.length > 0) {
      fs.writeFileSync(createdIssuesPath, JSON.stringify(createdKeys, null, 2), 'utf-8');
    }
  };

  // 7. Procesar Cascada en Orden Jerárquico Estricto: Epic → Story → Task
  try {
    for (let i = 0; i < backlog.length; i++) {
      const epicData = backlog[i];
      const epicNumber = i + 1;

      let epicKey: string;

      if (epicData.existingEpicKey) {
        console.log(`\n🔍 [ÉPICA ${epicNumber}/${backlog.length}] Buscando existente: "${epicData.summary}"...`);
        const foundEpic = await jiraService.findIssueBySummary(epicData.summary);
        if (!foundEpic) {
          console.error(`   ❌ No se encontró la épica "${epicData.summary}" en el proyecto. ¿Ya fue creada?`);
          process.exit(1);
        }
        epicKey = foundEpic.key;
        console.log(`   ✅ Épica encontrada: [ ${epicKey} ]`);
      } else {
        console.log(`\n👑 [ÉPICA ${epicNumber}/${backlog.length}] Creando: "${epicData.summary}"...`);
        if (epicData.priority) console.log(`   🔸 Prioridad: ${epicData.priority}`);
        const epicResponse = await jiraService.createIssue(
          epicData.summary,
          epicData.description || 'Creado automáticamente',
          config.JIRA_EPIC_TYPE,
          undefined,
          epicData.priority
        );
        epicKey = epicResponse.key;
        epicsCreated++;
        createdKeys.push(epicKey);
        const epicLink = `${config.JIRA_HOST.replace(/\/$/, '')}/browse/${epicKey}`;
        console.log(`   ➡️ ¡Creada con éxito! Key: [ ${epicKey} ]`);
        console.log(`   🔗 Enlace: ${epicLink}`);
      }
      console.log('');

      // Iterar Historias de Usuario asociadas a esta Épica
      const stories = epicData.stories || [];
      for (let j = 0; j < stories.length; j++) {
        const storyData = stories[j];
        const storyNumber = j + 1;

        let storyKey: string;

        if (storyData.existingStoryKey) {
          console.log(`   🔍 [HU ${storyNumber}/${stories.length}] Buscando existente: "${storyData.summary}"...`);
          const foundStory = await jiraService.findIssueBySummary(storyData.summary);
          if (!foundStory) {
            console.error(`   ❌ No se encontró la HU "${storyData.summary}" en el proyecto. ¿Ya fue creada?`);
            process.exit(1);
          }
          storyKey = foundStory.key;
          console.log(`   ✅ HU encontrada: [ ${storyKey} ]`);
        } else {
          console.log(`   📄 [HU ${storyNumber}/${stories.length}] Creando: "${storyData.summary}"...`);
          if (storyData.priority) console.log(`      🔸 Prioridad: ${storyData.priority}`);
          if (storyData.storyPoints !== undefined) console.log(`      🔸 Story Points: ${storyData.storyPoints}`);
          const storyResponse = await jiraService.createIssue(
            storyData.summary,
            storyData.description || 'Creado automáticamente',
            config.JIRA_STORY_TYPE,
            epicKey,
            storyData.priority,
            storyData.storyPoints
          );
          storyKey = storyResponse.key;
          storiesCreated++;
          createdKeys.push(storyKey);
          const storyLink = `${config.JIRA_HOST.replace(/\/$/, '')}/browse/${storyKey}`;
          console.log(`      ➡️ ¡Creada con éxito! Key: [ ${storyKey} ] (Asociada a Épica: ${epicKey})`);
          console.log(`      🔗 Enlace: ${storyLink}`);
        }
        console.log('');

        // Iterar Tareas asociadas a esta HU
        const tasks = storyData.tasks || [];
        for (let k = 0; k < tasks.length; k++) {
          const taskData = tasks[k];
          const taskNumber = k + 1;

          console.log(`      🛠️ [SUBTAREA ${taskNumber}/${tasks.length}] Creando: "${taskData.summary}"...`);
          if (taskData.priority) console.log(`         🔸 Prioridad: ${taskData.priority}`);
          
          const taskResponse = await jiraService.createIssue(
            taskData.summary,
            taskData.description || 'Creado automáticamente',
            config.JIRA_SUBTASK_TYPE,
            storyKey,
            taskData.priority
          );

          tasksCreated++;
          createdKeys.push(taskResponse.key);
          const taskLink = `${config.JIRA_HOST.replace(/\/$/, '')}/browse/${taskResponse.key}`;
          console.log(`         ➡️ ¡Creada con éxito! Key: [ ${taskResponse.key} ] (Asociada a HU: ${storyKey})`);
          console.log(`         🔗 Enlace: ${taskLink}`);
        }
        if (tasks.length > 0) console.log('');
      }
      console.log('----------------------------------------------------------------------');
    }

    // Persistir el listado total al finalizar con éxito
    saveCreatedKeys();

    // 8. Reporte Final de Éxito
    console.log('\n======================================================================');
    console.log('🎉 APROVISIONAMIENTO COMPLETADO DE MANERA EXITOSA');
    console.log('======================================================================');
    console.log(`👑 Épicas creadas:     ${epicsCreated}`);
    console.log(`📄 Historias creadas:  ${storiesCreated}`);
    console.log(`🛠️ Subtareas creadas:  ${tasksCreated}`);
    console.log(`📊 Total de issues:    ${epicsCreated + storiesCreated + tasksCreated}`);
    console.log('----------------------------------------------------------------------');
    if (projectName) {
      console.log(`💡 Para limpiar este backlog: pnpm run purge ${projectName}`);
    } else {
      console.log('💡 Para limpiar este backlog: pnpm run purge');
    }
    console.log('======================================================================\n');

  } catch (error: any) {
    // Persistimos los issues que se hayan alcanzado a crear antes de que falle el flujo
    saveCreatedKeys();

    console.error('\n======================================================================');
    console.error('❌ ERROR DURANTE LA EJECUCIÓN DEL APROVISIONAMIENTO EN CASCADA');
    console.error('El script se detuvo para evitar elementos huérfanos o desordenados.');
    console.error(`Detalle del error: ${error.message}`);
    console.error('----------------------------------------------------------------------');
    if (projectName) {
      console.error(`💡 Podés limpiar los issues creados hasta este punto con:\n   pnpm run purge ${projectName}`);
    } else {
      console.error('💡 Podés limpiar los issues creados hasta este punto con:\n   pnpm run purge');
    }
    console.error('======================================================================\n');
    process.exit(1);
  }
}

main();
