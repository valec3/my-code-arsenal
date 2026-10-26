import type { Issue, IssueType } from '../domain/issue';

export interface ProjectSnapshot {
  project: { key: string; name: string };
  issueTypes: readonly IssueType[];
  issues: readonly Issue[];
}

export interface SimilarIssue {
  key: string;
  summary: string;
  status: string;
}

export interface IssueStore {
  saveSnapshot(snapshot: ProjectSnapshot): void;
  listIssues(projectKey: string): Issue[];
  countIssues(projectKey: string): number;
  upsertIssue(issue: Issue): void;
  getIssue(key: string): Issue | null;
  listIssueTypes(projectKey: string): IssueType[];
  searchSimilar(projectKey: string, text: string, limit?: number): SimilarIssue[];
  listProjectKeys(): string[];
}
