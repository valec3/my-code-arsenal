import type { CreateIssueInput, Issue, IssueType, JiraField } from '../domain/issue';
import type { IssueTransition } from '../domain/transition';

export interface JiraGateway {
  getMyself(): Promise<{ displayName: string; emailAddress: string }>;
  getProject(key: string): Promise<{ key: string; name: string }>;
  searchIssues(jql: string, fields: readonly string[]): Promise<Issue[]>;
  getIssue(key: string): Promise<Issue>;
  getIssueTypes(projectKey: string): Promise<IssueType[]>;
  getFields(): Promise<JiraField[]>;
  createIssue(input: CreateIssueInput): Promise<{ key: string; id: string }>;
  getTransitions(issueKey: string): Promise<IssueTransition[]>;
  transitionIssue(issueKey: string, transitionId: string): Promise<void>;
  deleteIssue(key: string): Promise<void>;
}
