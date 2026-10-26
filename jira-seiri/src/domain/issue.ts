export interface IssueType {
  id: string;
  name: string;
  hierarchyLevel: number;
  subtask: boolean;
}

export interface Issue {
  key: string;
  projectKey: string;
  parentKey: string | null;
  summary: string;
  description: string;
  issueType: string;
  hierarchyLevel: number;
  status: string;
  priority: string | null;
  storyPoints: number | null;
  jiraCreatedAt: string | null;
  jiraUpdatedAt: string | null;
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
}

export interface CreateIssueInput {
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
  parentKey?: string;
  priority?: string;
  storyPoints?: number;
}
