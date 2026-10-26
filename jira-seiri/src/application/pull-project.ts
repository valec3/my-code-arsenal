import type { JiraGateway } from '../ports/jira-gateway';
import type { IssueStore } from '../ports/issue-store';
import { buildContext } from './build-context';

export interface PullOptions {
  project: string;
  projectKey: string;
  host: string;
  days: number;
  jql?: string;
  maxIssues: number;
  storyPointsField?: string;
}

export interface PullResult {
  projectKey: string;
  fetched: number;
  local: number;
  issueTypes: number;
  contextMarkdown: string;
}

const BASE_FIELDS = [
  'summary',
  'description',
  'issuetype',
  'status',
  'priority',
  'parent',
  'created',
  'updated',
];

export async function pullProject(
  deps: { gateway: JiraGateway; store: IssueStore },
  options: PullOptions
): Promise<PullResult> {
  const jql = options.jql?.trim() || defaultJql(options.projectKey, options.days);
  const fields = options.storyPointsField
    ? [...BASE_FIELDS, options.storyPointsField]
    : BASE_FIELDS;

  const [project, issueTypes, fetched] = await Promise.all([
    deps.gateway.getProject(options.projectKey),
    deps.gateway.getIssueTypes(options.projectKey),
    deps.gateway.searchIssues(jql, fields),
  ]);

  deps.store.saveSnapshot({ project, issueTypes, issues: fetched });

  const localIssues = deps.store.listIssues(options.projectKey);
  const contextMarkdown = buildContext(localIssues, issueTypes, {
    project: options.project,
    projectKey: options.projectKey,
    host: options.host,
    days: options.days,
    maxIssues: options.maxIssues,
    jql: options.jql?.trim() || undefined,
  });

  return {
    projectKey: options.projectKey,
    fetched: fetched.length,
    local: localIssues.length,
    issueTypes: issueTypes.length,
    contextMarkdown,
  };
}

export function defaultJql(projectKey: string, days: number): string {
  return `project = "${projectKey}" AND updated >= -${days}d ORDER BY updated DESC`;
}
