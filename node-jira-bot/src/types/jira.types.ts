// ==============================================================================
// 1. ESTRUCTURA DEL BACKLOG JSON DE ENTRADA
// ==============================================================================

export interface BacklogTask {
  summary: string;
  description?: string;
  priority?: string;
}

export interface BacklogStory {
  summary: string;
  description?: string;
  priority?: string;
  storyPoints?: number;
  tasks?: BacklogTask[];
}

export interface BacklogEpic {
  summary: string;
  description?: string;
  priority?: string;
  stories?: BacklogStory[];
}

// ==============================================================================
// 2. PAYLOADS DE LA API DE JIRA REST V3
// ==============================================================================

export interface JiraADFNode {
  type: string;
  text?: string;
  content?: JiraADFNode[];
  [key: string]: any;
}

export interface JiraADFDocument {
  version: number;
  type: 'doc';
  content: JiraADFNode[];
}

export interface JiraCreateIssueFields {
  project: {
    key: string;
  };
  summary: string;
  description?: JiraADFDocument;
  issuetype: {
    name: string;
  };
  parent?: {
    key: string;
  };
  [key: string]: any; // Permite extensiones futuras
}

export interface JiraCreateIssuePayload {
  fields: JiraCreateIssueFields;
}

// ==============================================================================
// 3. RESPUESTAS DE LA API DE JIRA REST V3
// ==============================================================================

export interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}
