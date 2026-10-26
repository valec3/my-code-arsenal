import type { CreateIssueInput, Issue, IssueType, JiraField } from '../domain/issue';
import type { CreateSprintInput, JiraBoard, JiraSprint } from '../domain/sprint';
import type { IssueTransition } from '../domain/transition';
import type { JiraUser } from '../domain/user';

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
  listAssignableUsers(projectKey: string): Promise<JiraUser[]>;
  assignIssue(issueKey: string, accountId: string): Promise<void>;
  listBoards(projectKey: string): Promise<JiraBoard[]>;
  listSprints(boardId: number, states?: readonly string[]): Promise<JiraSprint[]>;
  createSprint(input: CreateSprintInput): Promise<JiraSprint>;
  moveIssuesToSprint(sprintId: number, keys: readonly string[]): Promise<void>;
  deleteIssue(key: string): Promise<void>;
}
