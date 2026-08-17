import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// ==============================================================================
// CONFIGURACIÓN MULTI-PROYECTO
// ==============================================================================
// Soporta múltiples proyectos mediante carpetas dedicadas bajo projects/<nombre>/.
// Cada carpeta contiene su propio .env (con JIRA_PROJECT_KEY y tipos custom)
// y su propio backlog.json.
//
// El .env raíz contiene las credenciales compartidas (JIRA_HOST, JIRA_USER_EMAIL,
// JIRA_API_TOKEN). El .env del proyecto solo necesita especificar JIRA_PROJECT_KEY
// y opcionalmente JIRA_EPIC_TYPE, JIRA_STORY_TYPE, JIRA_SUBTASK_TYPE.
// ==============================================================================

export interface EnvConfig {
  JIRA_HOST: string;
  JIRA_USER_EMAIL: string;
  JIRA_API_TOKEN: string;
  JIRA_PROJECT_KEY: string;
  JIRA_EPIC_TYPE: string;
  JIRA_STORY_TYPE: string;
  JIRA_SUBTASK_TYPE: string;
  JIRA_STORY_POINTS_FIELD: string;
}

/**
 * Carga la configuración combinando el .env raíz (credenciales comunes)
 * con el .env del proyecto (JIRA_PROJECT_KEY y tipos específicos).
 *
 * @param projectName Nombre del proyecto (carpeta bajo projects/). Si no se
 *   especifica, solo se carga el .env raíz (modo legacy single-project).
 * @returns Configuración tipada lista para usar.
 */
export function loadConfig(projectName?: string): EnvConfig {
  // 1. Cargar .env raíz (credenciales comunes: HOST, EMAIL, TOKEN)
  dotenv.config();

  // 2. Si hay proyecto, cargar su .env encima (override)
  if (projectName) {
    const projectEnvPath = path.resolve(process.cwd(), 'projects', projectName, '.env');
    if (!fs.existsSync(projectEnvPath)) {
      console.error(`\n================================================================================`);
      console.error(`❌ ERROR: No se encontró el archivo .env del proyecto "${projectName}".`);
      console.error(`   Ruta esperada: ${projectEnvPath}`);
      console.error(`   Asegurate de haber creado la carpeta projects/${projectName}/ con su .env`);
      console.error(`================================================================================\n`);
      process.exit(1);
    }
    dotenv.config({ path: projectEnvPath, override: true });
    console.log(`📁 Proyecto activo: ${projectName}`);
  }

  // 3. Validar variables obligatorias
  const requiredEnvVars = ['JIRA_HOST', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN'];
  const projectRequired = ['JIRA_PROJECT_KEY'];

  if (projectName) {
    requiredEnvVars.push(...projectRequired);
  }

  const missingVars: string[] = [];
  requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
      missingVars.push(key);
    }
  });

  if (missingVars.length > 0) {
    console.error(`\n================================================================================`);
    console.error(`❌ ERROR CRÍTICO DE CONFIGURACIÓN: Faltan variables de entorno obligatorias.`);
    if (projectName) {
      console.error(`   Proyecto: ${projectName}`);
      console.error(`   Verificá tanto el .env raíz como projects/${projectName}/.env`);
    } else {
      console.error(`   Verificá tu archivo .env en la raíz de node-jira-bot/`);
    }
    missingVars.forEach((v) => console.error(`   - ${v}`));
    console.error(`================================================================================\n`);
    process.exit(1);
  }

  return {
    JIRA_HOST: process.env.JIRA_HOST!,
    JIRA_USER_EMAIL: process.env.JIRA_USER_EMAIL!,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN!,
    JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY || 'KAN',
    JIRA_EPIC_TYPE: process.env.JIRA_EPIC_TYPE || 'Epic',
    JIRA_STORY_TYPE: process.env.JIRA_STORY_TYPE || 'Story',
    JIRA_SUBTASK_TYPE: process.env.JIRA_SUBTASK_TYPE || 'Sub-task',
    JIRA_STORY_POINTS_FIELD: process.env.JIRA_STORY_POINTS_FIELD || 'customfield_10016',
  };
}

// Singleton legacy: carga solo el .env raíz (sin proyecto específico).
// Se mantiene para backward compatibility. Nuevo código debería usar loadConfig().
dotenv.config();

export const env: EnvConfig = {
  JIRA_HOST: process.env.JIRA_HOST!,
  JIRA_USER_EMAIL: process.env.JIRA_USER_EMAIL!,
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN!,
  JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY || 'KAN',
  JIRA_EPIC_TYPE: process.env.JIRA_EPIC_TYPE || 'Epic',
  JIRA_STORY_TYPE: process.env.JIRA_STORY_TYPE || 'Story',
  JIRA_SUBTASK_TYPE: process.env.JIRA_SUBTASK_TYPE || 'Task',
  JIRA_STORY_POINTS_FIELD: process.env.JIRA_STORY_POINTS_FIELD || 'customfield_10016',
};
