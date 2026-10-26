import { SeiriError } from '../../domain/errors';
import type { CreateIssueInput, Issue, IssueType, JiraField } from '../../domain/issue';
import type { IssueTransition } from '../../domain/transition';
import type { JiraGateway } from '../../ports/jira-gateway';
import { adfToPlainText, plainTextToAdf } from './adf';
import { JiraHttpClient, type JiraConnectionConfig } from './client';
import type {
  JiraCreateIssueResponseDto,
  JiraFieldDto,
  JiraIssueDto,
  JiraIssueFieldsDto,
  JiraIssueTypesPageDto,
  JiraSearchResponseDto,
  JiraTransitionsResponseDto,
} from './dto';

const PAGE_SIZE = 100;

export interface JiraGatewayOptions {
  storyPointsField?: string;
}

export class HttpJiraGateway implements JiraGateway {
  constructor(
    private readonly http: JiraHttpClient,
    private readonly options: JiraGatewayOptions = {}
  ) {}

  async getMyself(): Promise<{ displayName: string; emailAddress: string }> {
    const data = await this.http.get<{ displayName?: string; emailAddress?: string }>('/myself');
    return {
      displayName: data.displayName ?? '',
      emailAddress: data.emailAddress ?? '',
    };
  }

  async getProject(key: string): Promise<{ key: string; name: string }> {
    const data = await this.http.get<{ key?: string; name?: string }>(
      `/project/${encodeURIComponent(key)}`
    );
    return { key: data.key ?? key, name: data.name ?? key };
  }

  async searchIssues(jql: string, fields: readonly string[]): Promise<Issue[]> {
    const issues: Issue[] = [];
    let nextPageToken: string | undefined;

    do {
      const params: Record<string, unknown> = {
        jql,
        fields: fields.join(','),
        maxResults: PAGE_SIZE,
      };
      if (nextPageToken) {
        params.nextPageToken = nextPageToken;
      }

      const page = await this.http.get<JiraSearchResponseDto>('/search/jql', params);
      for (const dto of page.issues ?? []) {
        issues.push(this.mapIssue(dto));
      }

      nextPageToken = page.nextPageToken;
    } while (nextPageToken);

    return issues;
  }

  async getIssue(key: string): Promise<Issue> {
    const dto = await this.http.get<JiraIssueDto>(`/issue/${encodeURIComponent(key)}`);
    return this.mapIssue(dto);
  }

  async getIssueTypes(projectKey: string): Promise<IssueType[]> {
    const types: IssueType[] = [];
    let startAt = 0;

    for (;;) {
      const page = await this.http.get<JiraIssueTypesPageDto>(
        `/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`,
        { startAt, maxResults: PAGE_SIZE }
      );

      const batch = page.issueTypes ?? [];
      for (const dto of batch) {
        types.push({
          id: dto.id,
          name: dto.name,
          subtask: dto.subtask ?? false,
          hierarchyLevel: dto.hierarchyLevel ?? (dto.subtask ? -1 : 0),
        });
      }

      startAt += batch.length;
      const total = page.total ?? types.length;
      if (batch.length === 0 || startAt >= total) {
        break;
      }
    }

    return types;
  }

  async getFields(): Promise<JiraField[]> {
    const data = await this.http.get<JiraFieldDto[]>('/field');
    return data.map((field) => ({
      id: field.id,
      name: field.name,
      custom: field.custom ?? false,
    }));
  }

  async createIssue(input: CreateIssueInput): Promise<{ key: string; id: string }> {
    const fields: Record<string, unknown> = {
      project: { key: input.projectKey },
      summary: input.summary,
      description: plainTextToAdf(input.description),
      issuetype: { name: input.issueType },
    };

    if (input.parentKey) {
      fields.parent = { key: input.parentKey };
    }
    if (input.priority) {
      fields.priority = { name: input.priority };
    }
    if (input.storyPoints !== undefined) {
      if (!this.options.storyPointsField) {
        throw new SeiriError(
          'Falta configurar el campo de story points',
          'CONFIG',
          'Se resuelve con seiri pull o con JIRA_STORY_POINTS_FIELD'
        );
      }
      fields[this.options.storyPointsField] = input.storyPoints;
    }

    const created = await this.http.post<JiraCreateIssueResponseDto>('/issue', { fields });
    return { key: created.key, id: created.id };
  }

  async deleteIssue(key: string): Promise<void> {
    await this.http.delete(`/issue/${encodeURIComponent(key)}`);
  }

  async getTransitions(issueKey: string): Promise<IssueTransition[]> {
    const data = await this.http.get<JiraTransitionsResponseDto>(
      `/issue/${encodeURIComponent(issueKey)}/transitions`
    );

    return (data.transitions ?? []).map((transition) => ({
      id: transition.id,
      name: transition.name,
      to: transition.to?.name ?? transition.name,
    }));
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.http.post<void>(
      `/issue/${encodeURIComponent(issueKey)}/transitions`,
      { transition: { id: transitionId } }
    );
  }

  private mapIssue(dto: JiraIssueDto): Issue {
    const fields = dto.fields ?? {};
    const issueType = fields.issuetype ?? {};

    return {
      key: dto.key,
      projectKey: projectKeyOf(dto.key),
      parentKey: fields.parent?.key ?? null,
      summary: fields.summary ?? '',
      description: adfToPlainText(fields.description).trim(),
      issueType: issueType.name ?? '',
      hierarchyLevel: issueType.hierarchyLevel ?? (issueType.subtask ? -1 : 0),
      status: fields.status?.name ?? 'Unknown',
      priority: fields.priority?.name ?? null,
      storyPoints: this.readStoryPoints(fields),
      jiraCreatedAt: fields.created ?? null,
      jiraUpdatedAt: fields.updated ?? null,
    };
  }

  private readStoryPoints(fields: JiraIssueFieldsDto): number | null {
    if (!this.options.storyPointsField) {
      return null;
    }

    const value = fields[this.options.storyPointsField];
    return typeof value === 'number' ? value : null;
  }
}

function projectKeyOf(issueKey: string): string {
  const separator = issueKey.lastIndexOf('-');
  return separator > 0 ? issueKey.slice(0, separator) : issueKey;
}

export function createJiraGateway(
  config: JiraConnectionConfig,
  options: JiraGatewayOptions = {}
): JiraGateway {
  return new HttpJiraGateway(new JiraHttpClient(config), options);
}
