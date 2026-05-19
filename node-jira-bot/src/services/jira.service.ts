import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { convertPlaintextToADF } from '../utils/adf';
import { JiraCreateIssuePayload, JiraCreateIssueResponse } from '../types/jira.types';

export class JiraService {
  private client: AxiosInstance;

  constructor() {
    const authHeader = Buffer.from(`${env.JIRA_USER_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64');
    
    this.client = axios.create({
      baseURL: `${env.JIRA_HOST.replace(/\/$/, '')}/rest/api/3`,
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
          key: env.JIRA_PROJECT_KEY
        },
        summary: summary,
        description: convertPlaintextToADF(description),
        issuetype: {
          name: issueTypeName
        }
      }
    };

    // Si se provee un parentKey, se inyecta en los fields del payload para asociarlo.
    // Esto vincula automáticamente una Story a una Epic, o una Subtarea a una Story.
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
      payload.fields[env.JIRA_STORY_POINTS_FIELD] = storyPoints;
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
          jql: `project = "${env.JIRA_PROJECT_KEY}"`,
          maxResults: 150, // Límite amplio para limpiezas de backlog medianos
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

export const jiraService = new JiraService();
