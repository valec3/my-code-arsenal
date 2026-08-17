import axios, { AxiosInstance } from 'axios';
import { EnvConfig, env } from '../config/env';
import { convertPlaintextToADF } from '../utils/adf';
import { JiraCreateIssuePayload, JiraCreateIssueResponse, JiraIssueSummary } from '../types/jira.types';

export class JiraService {
  private client: AxiosInstance;
  private config: EnvConfig;

  constructor(config: EnvConfig) {
    this.config = config;
    const authHeader = Buffer.from(`${config.JIRA_USER_EMAIL}:${config.JIRA_API_TOKEN}`).toString('base64');
    
    this.client = axios.create({
      baseURL: `${config.JIRA_HOST.replace(/\/$/, '')}/rest/api/3`,
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Valida la conexión contra la API de Jira Cloud.
   * Retorna información del usuario si la conexión es exitosa.
   */
  async testConnection(): Promise<{ displayName: string; emailAddress: string }> {
    try {
      const response = await this.client.get('/myself');
      return {
        displayName: response.data.displayName,
        emailAddress: response.data.emailAddress
      };
    } catch (error: any) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * Crea un issue genérico en Jira.
   * 
   * @param summary Resumen/Título
   * @param description Descripción (texto plano)
   * @param issueTypeName Tipo de issue (Epic, Story, Sub-task, etc.)
   * @param parentKey Clave del issue padre (opcional)
   * @param priority Prioridad de la tarea (opcional)
   * @param storyPoints Puntos de historia (opcional)
   */
  async createIssue(
    summary: string,
    description: string,
    issueTypeName: string,
    parentKey?: string,
    priority?: string,
    storyPoints?: number
  ): Promise<JiraCreateIssueResponse> {
    
    const payload: JiraCreateIssuePayload = {
      fields: {
        project: {
          key: this.config.JIRA_PROJECT_KEY
        },
        summary: summary,
        description: convertPlaintextToADF(description),
        issuetype: {
          name: issueTypeName
        }
      }
    };

    // Si se provee un parentKey, se inyecta en los fields del payload para asociarlo.
    // Vincula una Story/Task a una Epic, o una Subtarea a una Story/Task.
    if (parentKey) {
      payload.fields.parent = {
        key: parentKey
      };
    }

    // Inyectar Prioridad si se especifica
    if (priority) {
      payload.fields.priority = {
        name: priority
      };
    }

    // Inyectar Estimación de Puntos de Historia si se especifica y el tipo es numérico
    if (storyPoints !== undefined && storyPoints !== null) {
      payload.fields[this.config.JIRA_STORY_POINTS_FIELD] = storyPoints;
    }

    try {
      const response = await this.client.post<JiraCreateIssueResponse>('/issue', payload);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data) {
        const errorMessages = error.response.data.errorMessages || [];
        const errors = error.response.data.errors ? Object.entries(error.response.data.errors).map(([k, v]) => `${k}: ${v}`) : [];
        const allErrors = [...errorMessages, ...errors].join(', ');
        throw new Error(`HTTP ${error.response.status}: [${allErrors}]`);
      }
      throw error;
    }
  }

  async deleteIssue(issueKey: string): Promise<void> {
    try {
      await this.client.delete(`/issue/${issueKey}`);
    } catch (error: any) {
      if (error.response && error.response.data) {
        const errorMessages = error.response.data.errorMessages || [];
        const errors = error.response.data.errors ? Object.entries(error.response.data.errors).map(([k, v]) => `${k}: ${v}`) : [];
        const allErrors = [...errorMessages, ...errors].join(', ');
        throw new Error(`HTTP ${error.response.status}: [${allErrors}]`);
      }
      throw error;
    }
  }

  /**
   * Obtiene todas las claves (KEYs) de incidencias del proyecto configurado.
   */
  async getProjectIssueKeys(): Promise<string[]> {
    try {
      const response = await this.client.get('/search/jql', {
        params: {
          jql: `project = "${this.config.JIRA_PROJECT_KEY}"`,
          maxResults: 150,
          fields: 'key'
        }
      });
      const data = response.data || {};
      const list = Array.isArray(data.results) ? data.results : (Array.isArray(data.issues) ? data.issues : []);
      return list.map((issue: any) => issue.key);
    } catch (error: any) {
      throw new Error(this.parseError(error));
    }
  }

  async findIssueBySummary(summary: string): Promise<{ key: string; id: string } | null> {
    try {
      const jql = `project = "${this.config.JIRA_PROJECT_KEY}" AND summary ~ "${summary.replace(/"/g, '\\"')}"`;
      const response = await this.client.get('/search/jql', {
        params: {
          jql,
          maxResults: 1,
          fields: 'key'
        }
      });
      const issues = response.data?.issues || [];
      if (issues.length > 0) {
        return { key: issues[0].key, id: issues[0].id };
      }
      return null;
    } catch (error: any) {
      throw new Error(this.parseError(error));
    }
  }

  async getProjectIssues(): Promise<JiraIssueSummary[]> {
    try {
      const response = await this.client.get('/search/jql', {
        params: {
          jql: `project = "${this.config.JIRA_PROJECT_KEY}" ORDER BY issuetype ASC, key ASC`,
          maxResults: 200,
          fields: 'summary,issuetype,priority,status,parent'
        }
      });
      const data = response.data || {};
      const list = Array.isArray(data.issues) ? data.issues : (Array.isArray(data.values) ? data.values : []);
      return list.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields?.summary || '(sin título)',
        issuetype: issue.fields?.issuetype?.name || 'Desconocido',
        priority: issue.fields?.priority?.name || '—',
        status: issue.fields?.status?.name || 'Desconocido',
        parent: issue.fields?.parent?.key || null
      }));
    } catch (error: any) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * Formatea de forma descriptiva los errores retornados por la REST API de Jira Cloud.
   */
  private parseError(error: any): string {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      let errorMsg = `HTTP ${status}: `;
      if (data.errorMessages && data.errorMessages.length > 0) {
        errorMsg += data.errorMessages.join(', ');
      } else if (data.errors) {
        errorMsg += Object.entries(data.errors)
          .map(([key, val]) => `[${key}: ${val}]`)
          .join(', ');
      } else {
        errorMsg += JSON.stringify(data);
      }
      return errorMsg;
    }
    return error.message || 'Error de conexión de red desconocido.';
  }
}

export const jiraService = new JiraService(env);
