import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  LISTED_SERVERS,
  type ListedServersPort,
} from '@integrations/application/ports/listed-servers.port';
import {
  type FakeMcpServer,
  fakeMcpServer,
} from '@integrations/infrastructure/mcp/mcp-server.fake-spec';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import {
  TEAM_INTEGRATIONS,
  type TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';
import { enabledIntegrations } from '@work/domain/services/enabled-integrations';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOST = `host-mcp-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'m'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const ISSUED = 'issued-token';

interface InboxItem {
  readonly id: string;
  readonly taskId: string;
}

interface ReceivedRequest {
  readonly path: string;
  readonly form: URLSearchParams;
}

const bodyOf = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const answer = (reply: ServerResponse, body: unknown, status = 200) => {
  reply.writeHead(status, { 'content-type': 'application/json' });
  reply.end(JSON.stringify(body));
};

const authorizing = (received: ReceivedRequest[]) => {
  return async (
    request: IncomingMessage,
    reply: ServerResponse,
    origin: string,
  ): Promise<boolean> => {
    const path = new URL(request.url ?? '/', origin).pathname;
    const issuer = `${origin}/as`;

    if (path === '/.well-known/oauth-protected-resource/mcp') {
      answer(reply, {
        resource: `${origin}/mcp`,
        authorization_servers: [issuer],
        scopes_supported: ['issues'],
      });
      return true;
    }

    if (path === '/.well-known/oauth-authorization-server/as') {
      answer(reply, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        registration_endpoint: `${issuer}/register`,
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
      });
      return true;
    }

    if (path === '/as/register' && request.method === 'POST') {
      received.push({ path, form: new URLSearchParams() });
      answer(reply, { client_id: 'dcr-client', client_secret: 'dcr-secret' });
      return true;
    }

    if (path === '/as/token' && request.method === 'POST') {
      const form = new URLSearchParams(await bodyOf(request));

      received.push({ path, form });
      answer(reply, {
        access_token: ISSUED,
        refresh_token: 'issued-refresh',
        expires_in: 3600,
      });
      return true;
    }

    return false;
  };
};

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let tracker: FakeMcpServer;
let guarded: FakeMcpServer;
const authorized: ReceivedRequest[] = [];

const http = () => served(app);

const asOwner = {
  get: (path: string) =>
    http().get(path).set(TEST_USER_HEADER, team.owner.value),
  post: (path: string, body: object) =>
    http()
      .post(path)
      .set(TEST_USER_HEADER, team.owner.value)
      .set('Idempotency-Key', randomUUID())
      .send(body),
};

const runner = (token: string) => ({
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body ?? {}),
});

const integrationNamed = async (integration: string) =>
  (
    (
      await asOwner
        .get(
          `/api/v1/resources/workspaces/${team.workspaceId.value}/integrations`,
        )
        .expect(200)
    ).body.items as {
      integration: string;
      version: number;
      tools: Record<string, string>;
      spec: {
        kind: string;
        problem: string | null;
        tools: number;
        readAt: string;
      };
    }[]
  ).find((each) => each.integration === integration);

const createIntegration = (body: object) =>
  asOwner.post(
    `/api/v1/resources/teams/${team.teamId.value}/integrations`,
    body,
  );

const TOOLS = [
  'tracker.search-issues',
  'tracker.delete-issue',
  'tracker.check-policy',
  'tracker.ask-first',
];

const aClaimedRun = async (): Promise<{
  taskId: string;
  runId: string;
  token: string;
}> => {
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title: 'Tidy the tracker',
    originStationId: BUILD,
    createdById: team.owner.value,
    assigneeId: team.owner.value,
    currentRunId: runId,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    taskId,
    taskRevision: 0,
    stationId: BUILD,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Tidy the tracker.',
      handover: { options: ['review', 'done'], noteLimit: 0 },
      resume: { key: `${taskId}:${BUILD}` },
      manifest: TOOLS.map((name) => ({
        name,
        description: name,
        inputs: [],
        approval: null,
        integration: 'Tracker',
      })),
    },
  });

  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      bootId: 'boot_1',
      name: 'build-box',
      release: '0.1.0',
      containerRuntime: 'docker',
      capacity: 4,
      running: [],
      images: [
        {
          image: IMAGE,
          isDefault: true,
          harnesses: [{ id: 'dev', models: [] }],
        },
      ],
    })
    .expect(200);

  const assignment = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  expect(assignment.work.run.id).toBe(runId);

  return { taskId, runId, token: assignment.token };
};

const toolsUsed = async (runId: string) =>
  (
    await db
      .select({ payload: schema.eventOutbox.payload })
      .from(schema.eventOutbox)
      .where(
        and(
          eq(schema.eventOutbox.kind, 'run.tool-used'),
          sql`${schema.eventOutbox.payload}->'runId'->>'value' = ${runId}`,
        ),
      )
  ).map((each) => each.payload as Record<string, unknown>);

beforeAll(async () => {
  tracker = await fakeMcpServer();
  guarded = await fakeMcpServer({
    token: ISSUED,
    other: authorizing(authorized),
  });
  vi.stubEnv(
    'SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS',
    [new URL(tracker.url).host, new URL(guarded.url).host].join(','),
  );
  app = await openApp();
  db = app.get<DrizzleDatabase>(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `mcp-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await db.insert(schema.station).values([
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      lineId: DELIVERY,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
      harness: 'dev',
    },
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 2,
      kind: 'completed',
    },
  ]);

  await http()
    .post(`/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);

  const made = await createIntegration({
    integration: 'tracker',
    name: 'Tracker',
    mcp: { url: tracker.url },
  });

  expect(made.status).toBe(201);
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
  await tracker?.close();
  await guarded?.close();
  vi.unstubAllEnvs();
});

describe('an integration naming a remote MCP server (e2e)', () => {
  it('provides the tools the server lists, asking approval for those that may write', async () => {
    const integration = await integrationNamed('tracker');

    expect(integration?.tools).toEqual({
      'search-issues': 'tracker.search-issues',
      'delete-issue': 'tracker.delete-issue',
      'check-policy': 'tracker.check-policy',
      'ask-first': 'tracker.ask-first',
    });
    expect(integration?.spec).toMatchObject({
      kind: 'mcp',
      problem: null,
      tools: 4,
    });

    const provided = await app
      .get<TeamIntegrationsPort>(TEAM_INTEGRATIONS)
      .provided(team.teamId, ['tracker.search-issues', 'tracker.delete-issue']);

    expect(
      provided.map((each) => [
        each.tool,
        each.integrationName,
        each.approval?.because ?? null,
        each.inputs.map((input) => [input.name, input.required]),
      ]),
    ).toEqual([
      [
        'tracker.search-issues',
        'Tracker',
        null,
        [
          ['query', true],
          ['limit', false],
        ],
      ],
      [
        'tracker.delete-issue',
        'Tracker',
        'It changes data in Tracker.',
        [['id', true]],
      ],
    ]);

    const declared = provided.map((each) =>
      ToolDeclarationMapper.toDeclared(each),
    );

    expect(declared.map(toolManifestOf)).toEqual([
      expect.objectContaining({
        name: 'tracker.search-issues',
        integration: 'Tracker',
        approval: null,
      }),
      expect.objectContaining({
        name: 'tracker.delete-issue',
        integration: 'Tracker',
        approval: { because: 'It changes data in Tracker.' },
      }),
    ]);
    expect(enabledIntegrations(declared)).toEqual([
      { name: 'Tracker', tools: 2 },
    ]);
  });

  it('lets one claim to list a server again win, moving when it was read on without changing its version', async () => {
    const servers = app.get<ListedServersPort>(LISTED_SERVERS);
    const before = await integrationNamed('tracker');
    const due = new Date(Date.now() + 60_000);
    const at = new Date(Date.now() + 120_000);

    const [one, other] = await Promise.all([
      servers.claimListedBefore(due, at),
      servers.claimListedBefore(due, at),
    ]);
    const claimed = [...one, ...other]
      .filter((each) => each.teamId.equals(team.teamId))
      .map((each) => each.integration.value);

    expect(claimed).toEqual(['tracker']);

    const after = await integrationNamed('tracker');

    expect(after?.version).toBe(before?.version);
    expect(after?.spec.readAt).toBe(at.toISOString());
  });

  it('runs a tool that only reads for a station, and journals it', async () => {
    const { runId, token } = await aClaimedRun();

    const used = await runner(token)
      .post(`/api/runs/${runId}/tools/tracker.search-issues`, {
        query: 'queue',
      })
      .expect(200);

    expect(used.body.output).toEqual({
      issues: [{ id: 'ENG-1', title: 'Queue stuck' }],
    });
    expect(tracker.called).toContainEqual({
      tool: 'search_issues',
      args: { query: 'queue' },
    });

    const journalled = await eventually(async () => {
      const found = await toolsUsed(runId);

      return found.length > 0 ? found : null;
    });

    expect(JSON.stringify(journalled)).toContain('tracker.search-issues');

    const inferred = await eventually(async () => {
      const [found] = await app
        .get<TeamIntegrationsPort>(TEAM_INTEGRATIONS)
        .provided(team.teamId, ['tracker.search-issues']);

      return found?.inferredOutput ?? null;
    });

    expect(JSON.stringify(inferred)).not.toContain('Queue stuck');
    expect(inferred).toMatchObject({
      properties: { issues: { type: 'array' } },
    });
  });

  it('stops a tool that may destroy data until a person approves it, and runs it with what they changed', async () => {
    const { taskId, runId, token } = await aClaimedRun();

    await runner(token)
      .post(`/api/runs/${runId}/tools/tracker.delete-issue`, { id: 'ENG-1' })
      .expect(409);
    expect(
      tracker.called.filter((each) => each.tool === 'delete_issue'),
    ).toEqual([]);

    const item = await eventually(async () =>
      (
        (await asOwner.get(`/api/workspaces/${team.slug}/inbox`).expect(200))
          .body as InboxItem[]
      ).find((each) => each.taskId === taskId),
    );

    await http()
      .post(`/api/workspaces/${team.slug}/inbox/${item.id}/answer`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({
        body: 'Delete the other one.',
        approve: true,
        inputs: [{ name: 'id', value: 'ENG-2' }],
      })
      .expect(204);

    const used = await runner(token)
      .post(`/api/runs/${runId}/tools/tracker.delete-issue`, { id: 'ENG-1' })
      .expect(200);

    expect(used.body.output).toEqual({ deleted: 'ENG-2' });
    expect(
      tracker.called.filter((each) => each.tool === 'delete_issue'),
    ).toEqual([{ tool: 'delete_issue', args: { id: 'ENG-2' } }]);
  });

  it('lets a tool.using hook deny a call to the server', async () => {
    const hooked = await asOwner.post(
      `/api/v1/resources/teams/${team.teamId.value}/hooks`,
      {
        key: 'searches-need-policy',
        on: 'tool.using',
        match: { tools: ['tracker.search-issues'] },
        failure: 'block',
        steps: [
          {
            name: 'policy',
            call: 'tracker.check-policy',
            with: { tool: 'tracker.search-issues' },
          },
        ],
      },
    );

    expect(hooked.status).toBe(201);

    try {
      const { runId, token } = await aClaimedRun();
      const searched = tracker.called.length;

      const denied = await runner(token)
        .post(`/api/runs/${runId}/tools/tracker.search-issues`, {
          query: 'stuck',
        })
        .expect(403);

      expect(denied.body.detail ?? denied.body.message).toMatch(
        /searches-need-policy/,
      );
      expect(tracker.called.slice(searched)).toEqual([
        { tool: 'check_policy', args: { tool: 'tracker.search-issues' } },
      ]);
    } finally {
      await db
        .delete(schema.hookDefinition)
        .where(eq(schema.hookDefinition.teamId, team.teamId.value));
    }
  });

  it('fails a call the server asks a question in the middle of', async () => {
    const { runId, token } = await aClaimedRun();

    const failed = await runner(token)
      .post(`/api/runs/${runId}/tools/tracker.ask-first`, {})
      .expect(502);

    expect(JSON.stringify(failed.body)).toMatch(
      /asked a question in the middle of the call/,
    );
  });

  it('connects to a server behind OAuth by what it publishes, registering Spotlight, with PKCE and the resource', async () => {
    const made = await createIntegration({
      integration: 'secure',
      name: 'Secure tracker',
      connection: { oauth2: { discover: true } },
      mcp: { url: guarded.url, auth: { oauth2: { connection: true } } },
    });

    expect(made.status).toBe(201);
    expect(made.body.spec.problem).toMatch(/answered 401/);

    const begun = await asOwner.post(
      `/api/teams/${team.teamId.value}/integrations/secure/connect`,
      {},
    );

    expect(begun.status).toBe(201);

    const authorize = new URL(begun.body.url);

    expect(`${authorize.origin}${authorize.pathname}`).toBe(
      `${guarded.origin}/as/authorize`,
    );
    expect(authorize.searchParams.get('client_id')).toBe('dcr-client');
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('resource')).toBe(guarded.url);
    expect(authorize.searchParams.get('scope')).toBe('issues');
    expect(authorized.map((each) => each.path)).toEqual(['/as/register']);

    const cookie = ([] as string[]).concat(begun.headers['set-cookie'] ?? []);
    const landed = await http()
      .get('/api/integrations/oauth/callback')
      .query({ state: authorize.searchParams.get('state'), code: 'the-code' })
      .set('Cookie', cookie.map((each) => each.split(';')[0]).join('; '))
      .set(TEST_USER_HEADER, team.owner.value);

    expect(landed.status).toBe(302);
    expect(landed.headers.location).toContain('connected=secure');

    const exchanged = authorized.find((each) => each.path === '/as/token');

    expect(exchanged?.form.get('code')).toBe('the-code');
    expect(exchanged?.form.get('client_id')).toBe('dcr-client');
    expect(exchanged?.form.get('resource')).toBe(guarded.url);
    expect(exchanged?.form.get('code_verifier')).toEqual(expect.any(String));

    const refreshed = await eventually(async () => {
      const secure = await integrationNamed('secure');

      return secure?.spec.tools === 4 ? secure : null;
    });

    expect(refreshed.spec.problem).toBeNull();
    expect(
      guarded.received.some(
        (each) =>
          each.path === '/mcp' && each.authorization === `Bearer ${ISSUED}`,
      ),
    ).toBe(true);
  });
});
