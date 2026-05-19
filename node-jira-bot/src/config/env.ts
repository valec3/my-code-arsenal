import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno del archivo .env local en el subproyecto
dotenv.config();

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

const requiredEnvVars = ['JIRA_HOST', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN'];
const missingVars: string[] = [];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    missingVars.push(key);
  }
});

if (missingVars.length > 0) {
  console.error('\n================================================================================');
  console.error('❌ ERROR CRÍTICO DE CONFIGURACIÓN: Faltan variables de entorno obligatorias.');
  console.error('Por favor, configurá las siguientes variables en tu archivo node-jira-bot/.env:');
  missingVars.forEach((v) => console.error(`  - ${v}`));
  console.error('================================================================================\n');
  process.exit(1);
}

export const env: EnvConfig = {
  JIRA_HOST: process.env.JIRA_HOST!,
  JIRA_USER_EMAIL: process.env.JIRA_USER_EMAIL!,
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN!,
  JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY || 'KAN',
  JIRA_EPIC_TYPE: process.env.JIRA_EPIC_TYPE || 'Epic',
  JIRA_STORY_TYPE: process.env.JIRA_STORY_TYPE || 'Story',
  JIRA_SUBTASK_TYPE: process.env.JIRA_SUBTASK_TYPE || 'Sub-task',
  JIRA_STORY_POINTS_FIELD: process.env.JIRA_STORY_POINTS_FIELD || 'customfield_10016'
};
