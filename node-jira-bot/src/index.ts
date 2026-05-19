import fs from 'fs';
import path from 'path';
import { env } from './config/env';
import { jiraService } from './services/jira.service';
import { BacklogEpic } from './types/jira.types';

// ==============================================================================
// ORQUESTADOR PRINCIPAL - CASCADA DE APROVISIONAMIENTO
// ==============================================================================

async function main() {
  console.clear();
  console.log('======================================================================');
  console.log('🚀 JIRA HIERARCHICAL PROVISIONER — CASCADA DE BACKLOG');
  console.log('======================================================================\n');

  // 1. Probar Conexión con Jira Cloud
  console.log('🔄 Validando credenciales de conexión con Jira Cloud...');
  try {
    const user = await jiraService.testConnection();
    console.log(`✅ ¡Conexión Establecida!`);
    console.log(`👤 Usuario: ${user.displayName}`);
    console.log(`📧 Email: ${user.emailAddress}`);
    console.log(`🏢 Host: ${env.JIRA_HOST}`);
    console.log(`🔑 Proyecto Destino: [${env.JIRA_PROJECT_KEY}]\n`);
  } catch (error: any) {
    console.error(`❌ Fallo de Conexión Crítico: ${error.message}`);
    process.exit(1);
  }

  // 2. Localizar y Cargar el Archivo backlog.json
  // Buscamos backlog.json tanto en el directorio raíz del subproyecto como en base al Cwd para mayor resiliencia
  const backlogPath = path.resolve(process.cwd(), 'backlog.json');
  
  if (!fs.existsSync(backlogPath)) {
    console.error('❌ Archivo de Backlog no encontrado.');
    console.error(`Buscado en la ruta: ${backlogPath}`);
    console.error('Por favor, creá el archivo backlog.json en la raíz de node-jira-bot/ antes de ejecutar.');
    process.exit(1);
  }

  console.log(`📂 Cargando backlog desde: ${backlogPath}...`);
  let backlog: BacklogEpic[] = [];

  try {
    const rawData = fs.readFileSync(backlogPath, 'utf-8');
    backlog = JSON.parse(rawData);
    
    if (!Array.isArray(backlog)) {
      // Si el usuario nos pasó una sola Épica como objeto en vez de un array, lo encapsulamos en un array
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

  // Estadísticas finales y registro de incidencias creadas para purga automática
  let epicsCreated = 0;
  let storiesCreated = 0;
  let tasksCreated = 0;
  const createdKeys: string[] = [];

  const saveCreatedKeys = () => {
    if (createdKeys.length > 0) {
      const logPath = path.resolve(process.cwd(), 'created-issues.json');
      fs.writeFileSync(logPath, JSON.stringify(createdKeys, null, 2), 'utf-8');
    }
  };

  // 3. Procesar Cascada en Orden Jerárquico Estricto
  try {
    for (let i = 0; i < backlog.length; i++) {
      const epicData = backlog[i];
      const epicNumber = i + 1;

      console.log(`\n👑 [ÉPICA ${epicNumber}/${backlog.length}] Creando: "${epicData.summary}"...`);
      if (epicData.priority) console.log(`   🔸 Prioridad: ${epicData.priority}`);
      
      // Crear la Épica
      const epicResponse = await jiraService.createIssue(
        epicData.summary,
        epicData.description || 'Creado automáticamente',
        env.JIRA_EPIC_TYPE,
        undefined,
        epicData.priority
      );
      
      epicsCreated++;
      createdKeys.push(epicResponse.key);
      const epicLink = `${env.JIRA_HOST.replace(/\/$/, '')}/browse/${epicResponse.key}`;
      console.log(`   ➡️ ¡Creada con éxito! Key: [ ${epicResponse.key} ]`);
      console.log(`   🔗 Enlace: ${epicLink}\n`);

      // Iterar HUs asociadas a esta Épica
      const stories = epicData.stories || [];
      for (let j = 0; j < stories.length; j++) {
        const storyData = stories[j];
        const storyNumber = j + 1;

        console.log(`   📄 [HU ${storyNumber}/${stories.length}] Creando: "${storyData.summary}"...`);
        if (storyData.priority) console.log(`      🔸 Prioridad: ${storyData.priority}`);
        if (storyData.storyPoints !== undefined) console.log(`      🔸 Story Points: ${storyData.storyPoints}`);
        
        // Crear la Story asociada a la Épica
        const storyResponse = await jiraService.createIssue(
          storyData.summary,
          storyData.description || 'Creado automáticamente',
          env.JIRA_STORY_TYPE,
          epicResponse.key, // Inyectamos Epic-Key como parent de la Story
          storyData.priority,
          storyData.storyPoints
        );

        storiesCreated++;
        createdKeys.push(storyResponse.key);
        const storyLink = `${env.JIRA_HOST.replace(/\/$/, '')}/browse/${storyResponse.key}`;
        console.log(`      ➡️ ¡Creada con éxito! Key: [ ${storyResponse.key} ] (Asociada a Épica: ${epicResponse.key})`);
        console.log(`      🔗 Enlace: ${storyLink}\n`);

        // Iterar Subtareas asociadas a esta HU
        const tasks = storyData.tasks || [];
        for (let k = 0; k < tasks.length; k++) {
          const taskData = tasks[k];
          const taskNumber = k + 1;

          console.log(`      🛠️ [TAREA ${taskNumber}/${tasks.length}] Creando: "${taskData.summary}"...`);
          if (taskData.priority) console.log(`         🔸 Prioridad: ${taskData.priority}`);
          
          // Crear la Subtarea asociada a la Story
          const taskResponse = await jiraService.createIssue(
            taskData.summary,
            taskData.description || 'Creado automáticamente',
            env.JIRA_SUBTASK_TYPE,
            storyResponse.key, // Inyectamos Story-Key como parent de la Subtarea
            taskData.priority
          );

          tasksCreated++;
          createdKeys.push(taskResponse.key);
          const taskLink = `${env.JIRA_HOST.replace(/\/$/, '')}/browse/${taskResponse.key}`;
          console.log(`         ➡️ ¡Creada con éxito! Key: [ ${taskResponse.key} ] (Asociada a HU: ${storyResponse.key})`);
          console.log(`         🔗 Enlace: ${taskLink}`);
        }
        if (tasks.length > 0) console.log(''); // Salto de línea estético
      }
      console.log('----------------------------------------------------------------------');
    }

    // Persistir el listado total al finalizar con éxito
    saveCreatedKeys();

    // 4. Reporte Final de Éxito
    console.log('\n======================================================================');
    console.log('🎉 APROVISIONAMIENTO COMPLETADO DE MANERA EXITOSA');
    console.log('======================================================================');
    console.log(`👑 Épicas creadas:     ${epicsCreated}`);
    console.log(`📄 Historias creadas:  ${storiesCreated}`);
    console.log(`🛠️ Subtareas creadas:  ${tasksCreated}`);
    console.log(`📊 Total de issues:    ${epicsCreated + storiesCreated + tasksCreated}`);
    console.log('----------------------------------------------------------------------');
    console.log('💡 Consejo: Si querés limpiar este backlog de prueba, simplemente corre:\n   pnpm run purge');
    console.log('======================================================================\n');

  } catch (error: any) {
    // Persistimos los issues que se hayan alcanzado a crear antes de que falle el flujo
    saveCreatedKeys();

    console.error('\n======================================================================');
    console.error('❌ ERROR DURANTE LA EJECUCIÓN DEL APROVISIONAMIENTO EN CASCADA');
    console.error('El script se detuvo para evitar elementos huérfanos o desordenados.');
    console.error(`Detalle del error: ${error.message}`);
    console.error('----------------------------------------------------------------------');
    console.error('💡 Nota: Podés limpiar los issues creados hasta este punto corriendo:\n   pnpm run purge');
    console.error('======================================================================\n');
    process.exit(1);
  }
}

main();
