import { randomUUID } from 'node:crypto';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import {
  HOST_CONNECTIONS,
  type HostConnectionRepository,
} from '@integrations/domain/repositories/host-connection.repository';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  RUN_GRANTS,
  type RunGrantsPort,
} from '@secrets/application/ports/run-grants.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
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
      does: 'comment',
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

describe('a secret worn by a tool call the control plane makes (e2e)', () => {
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

  const task = (): BoundTaskDto => ({
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
    const reached = (await app
      .get<IntegrationToolCallsPort>(INTEGRATION_TOOL_CALLS)
      .reach(
        'linear.comment',
        task(),
        { runId, attempt },
        null,
      )) as IntegrationTool;

    return reached.call({ body: 'Fixed in the queue worker.' });
  };

  const passedOn = globalThis.fetch;

  const hostOf = (url: string | URL | Request): string =>
    new URL(url instanceof Request ? url.url : String(url)).hostname;

  beforeAll(async () => {
    vi.stubEnv(
      'OUTBOUND_ALLOWED_HOSTS',
      [process.env.OUTBOUND_ALLOWED_HOSTS, 'api.linear.app']
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
      (await post(`/api/resources/teams/${workspaceId}/integrations`, LINEAR))
        .status,
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
      .delete(schema.hostConnection)
      .where(eq(schema.hostConnection.teamId, workspaceId));
    await db
      .delete(schema.learnedOutput)
      .where(eq(schema.learnedOutput.teamId, workspaceId));
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

  it('reaches the host wearing a secret bound to it', async () => {
    await post(
      `/api/resources/workspaces/${workspaceId}/secrets`,
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
    await post(`/api/resources/workspaces/${workspaceId}/secrets`, {
      ...secretBoundTo('api.linear.app'),
      bindings: [{ host: 'api.linear.app', carrier: 'query', name: 'key' }],
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

  it('learns what the tool answered, without its values, for the next run’s manifest', async () => {
    await post(
      `/api/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await comment();

    const [kept] = await eventually(() =>
      db
        .select()
        .from(schema.learnedOutput)
        .where(eq(schema.learnedOutput.teamId, workspaceId))
        .then((rows) => (rows.length > 0 ? rows : null)),
    );
    expect(kept?.tool).toBe('linear.comment');
    expect(JSON.stringify(kept?.shape)).not.toContain('linear.app');

    const [offered] = await app
      .get<TeamIntegrationsPort>(TEAM_INTEGRATIONS)
      .offered(TeamId.of(workspaceId), ['linear.comment']);
    expect(offered?.learnedOutput).toEqual({ type: 'string' });
  });

  it('grants the run the secret toward its host alone', async () => {
    await post(
      `/api/resources/workspaces/${workspaceId}/secrets`,
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
      `/api/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await expect(comment('run_8', 1)).resolves.toBe('https://linear.app/c/1');
    await expect(comment('run_8', 2)).resolves.toBe('https://linear.app/c/1');
    await expect(comment('run_8', 1)).rejects.toThrow(/for attempt 1 is over/);
    expect(fetch).toHaveBeenCalledTimes(2);

    const [kept] = await db
      .select({ attempt: schema.runGrants.attempt })
      .from(schema.runGrants)
      .where(eq(schema.runGrants.runId, 'run_8'));

    expect(kept?.attempt).toBe(2);
  });

  it('sends nothing for an attempt once its lost lease is heard, and grants the next attempt afresh', async () => {
    const grants = app.get<RunGrantsPort>(RUN_GRANTS);

    await post(
      `/api/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await expect(comment('run_9', 1)).resolves.toBe('https://linear.app/c/1');
    await grants.leaseLost({ workspaceId, runId: 'run_9', attempt: 1 });

    await expect(comment('run_9', 1)).rejects.toThrow(/for attempt 1 is over/);
    await expect(comment('run_9', 2)).resolves.toBe('https://linear.app/c/1');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for a run whose end was heard before anything was granted to it', async () => {
    await post(
      `/api/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await app
      .get<RunGrantsPort>(RUN_GRANTS)
      .endedFor({ workspaceId, runId: 'run_10', attempt: 1 });

    await expect(comment('run_10', 1)).rejects.toThrow(/has ended/);
    expect(fetch).not.toHaveBeenCalled();

    const [kept] = await db
      .select({ endedAt: schema.runGrants.endedAt })
      .from(schema.runGrants)
      .where(eq(schema.runGrants.runId, 'run_10'));

    expect(kept?.endedAt).toBeInstanceOf(Date);
  });

  it('sends nothing where the secret is bound to another host', async () => {
    await post(
      `/api/resources/workspaces/${workspaceId}/secrets`,
      secretBoundTo('uploads.linear.app'),
    );

    await expect(comment()).rejects.toThrow(/not bound to https:\/\/api/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends nothing where the workspace has no such secret', async () => {
    await expect(comment()).rejects.toThrow(/Secret LINEAR_API_KEY not found/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('seals a host connection’s tokens under the workspace’s data key', async () => {
    const connections = app.get<HostConnectionRepository>(HOST_CONNECTIONS);

    await connections.save(
      HostConnection.linkFrom({
        workspaceId: WorkspaceId.of(workspaceId),
        teamId: TeamId.of(workspaceId),
        source: SourceKey.of('slack'),
        holder: ConnectionHolder.team(),
        grant: HostGrant.of({
          accessToken: 'xoxb-sealed-1',
          refreshToken: 'xoxe-sealed-1',
        }),
      }),
    );

    const [row] = await db
      .select()
      .from(schema.hostConnection)
      .where(
        and(
          eq(schema.hostConnection.teamId, workspaceId),
          eq(schema.hostConnection.source, 'slack'),
        ),
      );
    const read = await connections.of(
      TeamId.of(workspaceId),
      SourceKey.of('slack'),
      ConnectionHolder.team(),
    );

    expect(row?.accessToken).not.toContain('xoxb-sealed-1');
    expect(row?.refreshToken).not.toContain('xoxe-sealed-1');
    expect(read?.accessToken.value).toBe('xoxb-sealed-1');
    expect(read?.refreshToken?.value).toBe('xoxe-sealed-1');
  });
});
