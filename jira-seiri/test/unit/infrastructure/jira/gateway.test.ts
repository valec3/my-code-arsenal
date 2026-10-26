import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SeiriError } from '../../../../src/domain/errors';
import { createJiraGateway } from '../../../../src/infrastructure/jira/gateway';

const HOST = 'https://acme.atlassian.net';
const API = '/rest/api/3';

function buildGateway(options: { storyPointsField?: string } = {}) {
  return createJiraGateway(
    {
      host: HOST,
      email: 'ana@acme.com',
      apiToken: 'secret',
      baseDelayMs: 1,
      maxRetries: 2,
      timeoutMs: 2000,
    },
    options
  );
}

function issueDto(key: string, summary: string) {
  return {
    id: key,
    key,
    fields: {
      summary,
      issuetype: { name: 'Task', hierarchyLevel: 0 },
      status: { name: 'To Do' },
      priority: { name: 'High' },
      description: {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Detalle' }],
          },
        ],
      },
      created: '2026-01-01T00:00:00.000+0000',
      updated: '2026-01-02T00:00:00.000+0000',
    },
  };
}

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

describe('HttpJiraGateway', () => {
  it('obtiene el usuario autenticado', async () => {
    const scope = nock(HOST, { reqheaders: { authorization: /^Basic / } })
      .get(`${API}/myself`)
      .reply(200, { displayName: 'Ana', emailAddress: 'ana@acme.com' });

    await expect(buildGateway().getMyself()).resolves.toEqual({
      displayName: 'Ana',
      emailAddress: 'ana@acme.com',
    });
    expect(scope.isDone()).toBe(true);
  });

  it('obtiene el proyecto', async () => {
    nock(HOST)
      .get(`${API}/project/ENG`)
      .reply(200, { id: '1', key: 'ENG', name: 'Engineering' });

    await expect(buildGateway().getProject('ENG')).resolves.toEqual({
      key: 'ENG',
      name: 'Engineering',
    });
  });

  it('obtiene una issue puntual por key', async () => {
    nock(HOST).get(`${API}/issue/ENG-5`).reply(200, issueDto('ENG-5', 'Detalle'));

    const issue = await buildGateway().getIssue('ENG-5');

    expect(issue).toMatchObject({
      key: 'ENG-5',
      projectKey: 'ENG',
      summary: 'Detalle',
      status: 'To Do',
      hierarchyLevel: 0,
    });
  });

  it('reintenta un 429 y termina bien', async () => {
    nock(HOST).get(`${API}/myself`).reply(429, {}, { 'Retry-After': '0' });
    nock(HOST)
      .get(`${API}/myself`)
      .reply(200, { displayName: 'Ana', emailAddress: 'ana@acme.com' });

    await expect(buildGateway().getMyself()).resolves.toMatchObject({ displayName: 'Ana' });
  });

  it('traduce un 400 a SeiriError con el detalle de Jira', async () => {
    nock(HOST).get(`${API}/myself`).reply(400, {
      errorMessages: ['jql invalido'],
      errors: { summary: 'es obligatorio' },
    });

    try {
      await buildGateway().getMyself();
      expect.unreachable('deberia haber fallado');
    } catch (error) {
      expect(error).toBeInstanceOf(SeiriError);
      const seiri = error as SeiriError;
      expect(seiri.code).toBe('JIRA');
      expect(seiri.message).toContain('jql invalido');
      expect(seiri.message).toContain('summary: es obligatorio');
    }
  });

  it('pagina la busqueda con nextPageToken', async () => {
    const first = nock(HOST)
      .get(`${API}/search/jql`)
      .query(
        (query) =>
          query.jql === 'project = ENG' &&
          query.fields === 'summary,description' &&
          query.maxResults === '100'
      )
      .reply(200, {
        issues: [issueDto('ENG-1', 'Primera')],
        nextPageToken: 'page-2',
        isLast: false,
      });

    const second = nock(HOST)
      .get(`${API}/search/jql`)
      .query((query) => query.nextPageToken === 'page-2')
      .reply(200, { issues: [issueDto('ENG-2', 'Segunda')], isLast: true });

    const issues = await buildGateway().searchIssues('project = ENG', [
      'summary',
      'description',
    ]);

    expect(issues.map((issue) => issue.key)).toEqual(['ENG-1', 'ENG-2']);
    expect(issues[0]).toMatchObject({
      projectKey: 'ENG',
      description: 'Detalle',
      status: 'To Do',
      priority: 'High',
    });
    expect(first.isDone() && second.isDone()).toBe(true);
  });

  it('pagina createmeta y calcula hierarchyLevel cuando falta', async () => {
    nock(HOST)
      .get(`${API}/issue/createmeta/ENG/issuetypes`)
      .query((query) => query.startAt === '0')
      .reply(200, {
        issueTypes: [{ id: '1', name: 'Epic', subtask: false, hierarchyLevel: 1 }],
        total: 2,
        startAt: 0,
        maxResults: 1,
      });

    nock(HOST)
      .get(`${API}/issue/createmeta/ENG/issuetypes`)
      .query((query) => query.startAt === '1')
      .reply(200, {
        issueTypes: [{ id: '2', name: 'Sub-task', subtask: true }],
        total: 2,
        startAt: 1,
        maxResults: 1,
      });

    const types = await buildGateway().getIssueTypes('ENG');

    expect(types).toEqual([
      { id: '1', name: 'Epic', subtask: false, hierarchyLevel: 1 },
      { id: '2', name: 'Sub-task', subtask: true, hierarchyLevel: -1 },
    ]);
  });

  it('crea un issue con ADF, parent, prioridad y story points', async () => {
    let body: any;

    nock(HOST)
      .post(`${API}/issue`, (payload) => {
        body = payload;
        return true;
      })
      .reply(201, { id: '10001', key: 'ENG-10' });

    const result = await buildGateway({ storyPointsField: 'customfield_10016' }).createIssue({
      projectKey: 'ENG',
      summary: '[BACKEND] Webhook',
      description: 'linea uno\nlinea dos',
      issueType: 'Sub-task',
      parentKey: 'ENG-9',
      priority: 'High',
      storyPoints: 5,
    });

    expect(result).toEqual({ id: '10001', key: 'ENG-10' });
    expect(body.fields.project).toEqual({ key: 'ENG' });
    expect(body.fields.issuetype).toEqual({ name: 'Sub-task' });
    expect(body.fields.parent).toEqual({ key: 'ENG-9' });
    expect(body.fields.priority).toEqual({ name: 'High' });
    expect(body.fields.customfield_10016).toBe(5);
    expect(body.fields.description.type).toBe('doc');
    expect(body.fields.description.content).toHaveLength(2);
  });

  it('exige el campo de story points si se piden puntos', async () => {
    await expect(
      buildGateway().createIssue({
        projectKey: 'ENG',
        summary: 'X',
        description: '',
        issueType: 'Task',
        storyPoints: 3,
      })
    ).rejects.toMatchObject({ code: 'CONFIG' });
  });

  it('lista campos y marca los custom', async () => {
    nock(HOST)
      .get(`${API}/field`)
      .reply(200, [
        { id: 'summary', name: 'Summary', custom: false },
        { id: 'customfield_10016', name: 'Story Points', custom: true },
      ]);

    await expect(buildGateway().getFields()).resolves.toEqual([
      { id: 'summary', name: 'Summary', custom: false },
      { id: 'customfield_10016', name: 'Story Points', custom: true },
    ]);
  });

  it('lista las transiciones disponibles de una issue', async () => {
    const scope = nock(HOST)
      .get(`${API}/issue/ENG-5/transitions`)
      .reply(200, {
        transitions: [
          { id: '31', name: 'Done', to: { name: 'Done' } },
          { id: '21', name: 'Empezar', to: { name: 'In Progress' } },
        ],
      });

    await expect(buildGateway().getTransitions('ENG-5')).resolves.toEqual([
      { id: '31', name: 'Done', to: 'Done' },
      { id: '21', name: 'Empezar', to: 'In Progress' },
    ]);
    expect(scope.isDone()).toBe(true);
  });

  it('aplica una transicion por id', async () => {
    let body: any;
    const scope = nock(HOST)
      .post(`${API}/issue/ENG-5/transitions`, (payload) => {
        body = payload;
        return true;
      })
      .reply(204);

    await expect(buildGateway().transitionIssue('ENG-5', '31')).resolves.toBeUndefined();
    expect(body).toEqual({ transition: { id: '31' } });
    expect(scope.isDone()).toBe(true);
  });

  it('lista usuarios asignables paginando y tolerando email oculto', async () => {
    const firstBatch = Array.from({ length: 100 }, (_, index) => ({
      accountId: `acc-${index}`,
      displayName: `User ${index}`,
      emailAddress: `u${index}@acme.com`,
      active: true,
    }));

    const first = nock(HOST)
      .get(`${API}/user/assignable/search`)
      .query(
        (query) => query.project === 'ENG' && query.startAt === '0' && query.maxResults === '100'
      )
      .reply(200, firstBatch);

    const second = nock(HOST)
      .get(`${API}/user/assignable/search`)
      .query((query) => query.project === 'ENG' && query.startAt === '100')
      .reply(200, [{ accountId: 'acc-100', displayName: 'Sin email', active: false }]);

    const users = await buildGateway().listAssignableUsers('ENG');

    expect(users).toHaveLength(101);
    expect(users[100]).toEqual({
      accountId: 'acc-100',
      displayName: 'Sin email',
      emailAddress: null,
      active: false,
    });
    expect(first.isDone() && second.isDone()).toBe(true);
  });

  it('asigna una issue por accountId', async () => {
    let body: any;
    const scope = nock(HOST)
      .put(`${API}/issue/ENG-5/assignee`, (payload) => {
        body = payload;
        return true;
      })
      .reply(204);

    await expect(buildGateway().assignIssue('ENG-5', 'acc-1')).resolves.toBeUndefined();
    expect(body).toEqual({ accountId: 'acc-1' });
    expect(scope.isDone()).toBe(true);
  });
});
