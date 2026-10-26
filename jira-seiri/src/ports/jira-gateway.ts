import type { CreateIssueInput, Issue, IssueType, JiraField } from '../domain/issue';

export interface JiraGateway {
  getMyself(): Promise<{ displayName: string; emailAddress: string }>;
  getProject(key: string): Promise<{ key: string; name: string }>;
  searchIssues(jql: string, fields: readonly string[]): Promise<Issue[]>;
  getIssueTypes(projectKey: string): Promise<IssueType[]>;
  getFields(): Promise<JiraField[]>;
  createIssue(input: CreateIssueInput): Promise<{ key: string; id: string }>;
  deleteIssue(key: string): Promise<void>;
}
