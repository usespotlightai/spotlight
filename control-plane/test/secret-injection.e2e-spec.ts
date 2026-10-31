import { randomUUID } from 'node:crypto';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import {
  INTEGRATION_CONNECTIONS,
  type IntegrationConnectionRepository,
} from '@integrations/domain/repositories/integration-connection.repository';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  RUN_GRANTS,
  type RunGrantsPort,
} from '@secrets/application/ports/run-grants.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import {
  INTEGRATION_TOOL_CALLS,
  type IntegrationTool,
  type IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';
import {
  TEAM_INTEGRATIONS,
  type TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';
import { and, eq, inArray } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const VALUE = 'lin_api_injected_4d2e';

const LINEAR = {
  integration: 'linear',
  actions: {
    comment: {
      request: {
        method: 'POST',
        url: 'https://api.linear.app/graphql',
        auth: { secrets: ['secret.LINEAR_API_KEY'] },
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
        body: { body: '${{ inputs.body }}' },
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
        capture: { url: '${{ response.url }}' },
      },
    },
  },
  tools: {
    comment: {
      action: 'comment',
      description: 'Comment on the Linear issue',
      inputs: { body: { required: true } },
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
      output: '${{ capture.url }}',
    },
  },
};

const secretBoundTo = (host: string) => ({
  name: 'LINEAR_API_KEY',
  bindings: [{ host, prefix: 'Bearer ' }],
  valueWo: VALUE,
  valueWoVersion: 1,
});

describe('a secret injected into a tool call that the control plane makes (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;

  const fetch = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ url: 'https://linear.app/c/1' }), {
        status: 200,
      }),
  );

  const post = (path: string, body: object) =>
    served(app)
      .post(path)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  const task = (): IntegrationTaskViewDto => ({
    taskId: 'task_1',
    workspaceId,
    teamId: workspaceId,
    line: 'delivery',
    station: 'Implementation',
    stationKey: 'implementation',
    marks: {},
    waiting: null,
  });

  const comment = async (runId = 'run_1', attempt = 1) => {
    const resolved = (await app
      .get<IntegrationToolCallsPort>(INTEGRATION_TOOL_CALLS)
      .resolve(
        'linear.comment',
        task(),
        { runId, attempt },
        null,
      )) as IntegrationTool;

    return resolved.call({ body: 'Fixed in the queue worker.' });
  };

  const passedOn = globalThis.fetch;

  const hostOf = (url: string | URL | Request): string =>
    new URL(url instanceof Request ? url.url : String(url)).hostname;

  beforeAll(async () => {
    vi.stubEnv(
      'SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS',
      [process.env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS, 'api.linear.app']
        .filter(Boolean)
        .join(','),
    );
    vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) =>
      hostOf(url) === 'api.linear.app' ? fetch(url, init) : passedOn(url, init),
    );
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    workspaceId = `injection-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, workspaceId);
    fetch.mockClear();

    expect(
      (
        await post(
          `/api/v1/resources/teams/${workspaceId}/integrations`,
          LINEAR,
        )
      ).status,
    ).toBe(201);
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${seat.owner}`]));
    await db
      .delete(schema.integrationDefinition)
      .where(eq(schema.integrationDefinition.teamId, workspaceId));
    await db
      .delete(schema.integrationConnection)
      .where(eq(schema.integrationConnection.teamId, workspaceId));
    await db
      .delete(schema.inferredOutputSchema)
      .where(eq(schema.inferredOutputSchema.teamId, workspaceId));
    await db
      .delete(schema.secret)
      .where(eq(schema.secret.workspaceId, workspaceId));
    await db
      .delete(schema.runGrants)
      .where(eq(schema.runGrants.workspaceId, workspaceId));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, workspaceId));
    await seat.unseat();
  });

  it('injects the secret that is bound to the host, and reaches the host', async () => {
    await post(
      `/api/v1/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await expect(comment()).resolves.toBe('https://linear.app/c/1');

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.linear.app/graphql');
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${VALUE}`,
    );
    expect(init.redirect).toBe('manual');
  });

  it('reaches the host with a secret bound to a query parameter, and keeps it out of the answer', async () => {
    await post(`/api/v1/resources/workspaces/${workspaceId}/secrets`, {
      ...secretBoundTo('api.linear.app'),
      bindings: [{ host: 'api.linear.app', location: 'query', name: 'key' }],
    });
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ url: `https://linear.app/c/1?key=${VALUE}` }),
        { status: 200 },
      ),
    );

    await expect(comment()).resolves.toBe(
      'https://linear.app/c/1?key=[secret]',
    );

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.get('key')).toBe(VALUE);
    expect(
      (init.headers as Record<string, string>).authorization,
    ).toBeUndefined();
  });

  it('infers an output schema from what the tool answered, without its values, for the next run’s manifest', async () => {
    await post(
      `/api/v1/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await comment();

    const [stored] = await eventually(() =>
      db
        .select()
        .from(schema.inferredOutputSchema)
        .where(eq(schema.inferredOutputSchema.teamId, workspaceId))
        .then((rows) => (rows.length > 0 ? rows : null)),
    );
    expect(stored?.tool).toBe('linear.comment');
    expect(JSON.stringify(stored?.shape)).not.toContain('linear.app');

    const [provided] = await app
      .get<TeamIntegrationsPort>(TEAM_INTEGRATIONS)
      .provided(TeamId.of(workspaceId), ['linear.comment']);
    expect(provided?.inferredOutput).toEqual({ type: 'string' });
  });

  it('grants the run the secret for its host alone', async () => {
    await post(
      `/api/v1/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await comment('run_7');

    expect(
      (
        await db
          .select({
            runId: schema.secretGrant.runId,
            host: schema.secretGrant.host,
          })
          .from(schema.secretGrant)
          .innerJoin(
            schema.runGrants,
            eq(schema.runGrants.runId, schema.secretGrant.runId),
          )
          .where(eq(schema.runGrants.workspaceId, workspaceId))
      ).map((each) => [each.runId, each.host]),
    ).toEqual([['run_7', 'api.linear.app']]);
  });

  it('grants each attempt of a run afresh, and nothing more to an attempt the run moved past', async () => {
    await post(
      `/api/v1/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await expect(comment('run_8', 1)).resolves.toBe('https://linear.app/c/1');
    await expect(comment('run_8', 2)).resolves.toBe('https://linear.app/c/1');
    await expect(comment('run_8', 1)).rejects.toThrow(/for attempt 1 is over/);
    expect(fetch).toHaveBeenCalledTimes(2);

    const [stored] = await db
      .select({ attempt: schema.runGrants.attempt })
      .from(schema.runGrants)
      .where(eq(schema.runGrants.runId, 'run_8'));

    expect(stored?.attempt).toBe(2);
  });

  it('sends nothing for an attempt once its lost lease is received, and grants the next attempt afresh', async () => {
    const grants = app.get<RunGrantsPort>(RUN_GRANTS);

    await post(
      `/api/v1/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await expect(comment('run_9', 1)).resolves.toBe('https://linear.app/c/1');
    await grants.leaseLost({ workspaceId, runId: 'run_9', attempt: 1 });

    await expect(comment('run_9', 1)).rejects.toThrow(/for attempt 1 is over/);
    await expect(comment('run_9', 2)).resolves.toBe('https://linear.app/c/1');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for a run whose end was received before anything was granted to it', async () => {
    await post(
      `/api/v1/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await app
      .get<RunGrantsPort>(RUN_GRANTS)
      .endedFor({ workspaceId, runId: 'run_10', attempt: 1 });

    await expect(comment('run_10', 1)).rejects.toThrow(/has ended/);
    expect(fetch).not.toHaveBeenCalled();

    const [stored] = await db
      .select({ endedAt: schema.runGrants.endedAt })
      .from(schema.runGrants)
      .where(eq(schema.runGrants.runId, 'run_10'));

    expect(stored?.endedAt).toBeInstanceOf(Date);
  });

  it('sends nothing where the secret is bound to another host', async () => {
    await post(
      `/api/v1/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('uploads.linear.app'),
    );

    await expect(comment()).rejects.toThrow(/not bound to https:\/\/api/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends nothing where the workspace has no such secret', async () => {
    await expect(comment()).rejects.toThrow(/Secret LINEAR_API_KEY not found/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('encrypts the tokens of an integration connection under the data key of the workspace', async () => {
    const connections = app.get<IntegrationConnectionRepository>(
      INTEGRATION_CONNECTIONS,
    );

    await connections.save(
      IntegrationConnection.connectFrom({
        workspaceId: WorkspaceId.of(workspaceId),
        teamId: TeamId.of(workspaceId),
        integration: IntegrationKey.of('slack'),
        owner: ConnectionOwner.team(),
        tokens: OAuthTokens.of({
          accessToken: 'xoxb-encrypted-1',
          refreshToken: 'xoxe-encrypted-1',
        }),
      }),
    );

    const [row] = await db
      .select()
      .from(schema.integrationConnection)
      .where(
        and(
          eq(schema.integrationConnection.teamId, workspaceId),
          eq(schema.integrationConnection.integration, 'slack'),
        ),
      );
    const read = await connections.of(
      TeamId.of(workspaceId),
      IntegrationKey.of('slack'),
      ConnectionOwner.team(),
    );

    expect(row?.accessToken).not.toContain('xoxb-encrypted-1');
    expect(row?.refreshToken).not.toContain('xoxe-encrypted-1');
    expect(read?.accessToken.value).toBe('xoxb-encrypted-1');
    expect(read?.refreshToken?.value).toBe('xoxe-encrypted-1');
  });
});
