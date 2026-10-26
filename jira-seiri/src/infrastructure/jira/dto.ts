export interface JiraIssueFieldsDto {
  summary?: string;
  description?: unknown;
  issuetype?: {
    id?: string;
    name?: string;
    hierarchyLevel?: number;
    subtask?: boolean;
  };
  status?: { name?: string };
  priority?: { name?: string };
  parent?: { key?: string };
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface JiraIssueDto {
  id: string;
  key: string;
  fields?: JiraIssueFieldsDto;
}

export interface JiraSearchResponseDto {
  issues?: JiraIssueDto[];
  nextPageToken?: string;
  isLast?: boolean;
}

export interface JiraIssueTypeDto {
  id: string;
  name: string;
  subtask?: boolean;
  hierarchyLevel?: number;
}

export interface JiraIssueTypesPageDto {
  issueTypes?: JiraIssueTypeDto[];
  startAt?: number;
  maxResults?: number;
  total?: number;
}

export interface JiraFieldDto {
  id: string;
  name: string;
  custom?: boolean;
}

export interface JiraCreateIssueResponseDto {
  id: string;
  key: string;
}

export interface JiraTransitionDto {
  id: string;
  name: string;
  to?: { name?: string };
}

export interface JiraTransitionsResponseDto {
  transitions?: JiraTransitionDto[];
}

export interface JiraErrorDto {
  errorMessages?: string[];
  errors?: Record<string, string>;
}
