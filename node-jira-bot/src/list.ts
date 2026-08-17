import { loadConfig } from './config/env';
import { JiraService } from './services/jira.service';

async function list() {
  const args = process.argv.slice(2);
  const projectName = args[0] || null;

  console.clear();
  console.log('======================================================================');
  console.log('📋 JIRA ISSUE LISTER');
  if (projectName) {
    console.log(`📁 Proyecto: ${projectName}`);
  }
  console.log('======================================================================\n');

  const config = loadConfig(projectName || undefined);
  const jiraService = new JiraService(config);

  console.log('🔄 Conectando con Jira Cloud...');
  try {
    const user = await jiraService.testConnection();
    console.log(`✅ Conectado como: ${user.displayName}`);
    console.log(`🔑 Proyecto: [${config.JIRA_PROJECT_KEY}]\n`);
  } catch (error: any) {
    console.error(`❌ Fallo de conexión: ${error.message}`);
    process.exit(1);
  }

  console.log('🔍 Buscando incidencias...');
  try {
    const issues = await jiraService.getProjectIssues();

    if (issues.length === 0) {
      console.log('📭 No se encontraron incidencias en este proyecto.\n');
      console.log('======================================================================\n');
      return;
    }

    console.log(`📊 Se encontraron [${issues.length}] incidencias:\n`);
    console.log('----------------------------------------------------------------------');

    const baseUrl = config.JIRA_HOST.replace(/\/$/, '');

    const colKey = 12;
    const colType = 12;
    const colPrio = 10;
    const colStatus = 14;

    const header =
      'KEY'.padEnd(colKey) +
      'TIPO'.padEnd(colType) +
      'PRIORIDAD'.padEnd(colPrio) +
      'ESTADO'.padEnd(colStatus) +
      'RESUMEN';
    console.log(header);
    console.log('─'.repeat(header.length + 10));

    for (const issue of issues) {
      const line =
        issue.key.padEnd(colKey) +
        issue.issuetype.padEnd(colType) +
        issue.priority.padEnd(colPrio) +
        issue.status.padEnd(colStatus) +
        issue.summary;
      console.log(line);

      if (issue.parent) {
        console.log(`${''.padStart(colKey)}└─ Padre: ${issue.parent}`);
      }
    }

    console.log('----------------------------------------------------------------------');

    const types = [...new Set(issues.map(i => i.issuetype))];
    console.log(`\n📊 Resumen por tipo:`);
    for (const type of types) {
      const count = issues.filter(i => i.issuetype === type).length;
      console.log(`   ${type}: ${count}`);
    }

    const baseLink = `${baseUrl}/browse`;
    console.log(`\n🔗 Links rápidos:`);
    for (const issue of issues) {
      console.log(`   ${issue.key}: ${baseLink}/${issue.key}`);
    }

  } catch (error: any) {
    console.error(`❌ Error al obtener incidencias: ${error.message}`);
    process.exit(1);
  }

  console.log('\n======================================================================\n');
}

list();
