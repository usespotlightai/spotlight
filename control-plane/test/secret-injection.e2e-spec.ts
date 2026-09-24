import { randomUUID } from 'node:crypto';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import {
  HOST_CONNECTIONS,
  type HostConnectionRepository,
} from '@integrations/domain/repositories/host-connection.repository';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import {
  INTEGRATION_TOOL_CALLS,
  type IntegrationTool,
  type IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';
import { and, eq, inArray } from 'drizzle-orm';
import request from 'supertest';
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
import { openApp, TEST_USER_HEADER } from './support/app';
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
  let held: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;

  const fetch = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ url: 'https://linear.app/c/1' }), {
        status: 200,
      }),
  );

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  const task = (): BoundTaskDto => ({
    taskId: 'task_1',
    workspaceId: held,
    teamId: held,
    line: 'delivery',
    station: 'Implementation',
    stationKey: 'implementation',
    marks: {},
    waiting: null,
  });

  const comment = async (runId = 'run_1') => {
    const reached = (await app
      .get<IntegrationToolCallsPort>(INTEGRATION_TOOL_CALLS)
      .reach('linear.comment', task(), runId)) as IntegrationTool;

    return reached.call({ body: 'Fixed in the queue worker.' });
  };

  beforeAll(async () => {
    process.env.OUTBOUND_ALLOWED_HOSTS = 'api.linear.app';
    vi.stubGlobal('fetch', fetch);
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllGlobals();
    delete process.env.OUTBOUND_ALLOWED_HOSTS;
  });

  beforeEach(async () => {
    held = `injection-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, held);
    fetch.mockClear();

    expect(
      (await post(`/api/resources/teams/${held}/integrations`, LINEAR)).status,
    ).toBe(201);
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${seat.owner}`]));
    await db
      .delete(schema.integrationDefinition)
      .where(eq(schema.integrationDefinition.teamId, held));
    await db
      .delete(schema.hostConnection)
      .where(eq(schema.hostConnection.teamId, held));
    await db.delete(schema.secret).where(eq(schema.secret.workspaceId, held));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, held));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, held));
    await seat.unseat();
  });

  it('reaches the host wearing a secret bound to it', async () => {
    await post(
      `/api/resources/workspaces/${held}/secrets`,
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

  it('grants the run the secret toward its host alone', async () => {
    await post(
      `/api/resources/workspaces/${held}/secrets`,
      secretBoundTo('api.linear.app'),
    );

    await comment('run_7');

    expect(
      (
        await db
          .select()
          .from(schema.secretGrant)
          .where(eq(schema.secretGrant.workspaceId, held))
      ).map((each) => [each.runId, each.host]),
    ).toEqual([['run_7', 'api.linear.app']]);
  });

  it('sends nothing where the secret is bound to another host', async () => {
    await post(
      `/api/resources/workspaces/${held}/secrets`,
      secretBoundTo('uploads.linear.app'),
    );

    await expect(comment()).rejects.toThrow(/not bound to https:\/\/api/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends nothing where the workspace holds no such secret', async () => {
    await expect(comment()).rejects.toThrow(
      /holds no secret named LINEAR_API_KEY/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('seals a host connection’s tokens under the workspace’s data key', async () => {
    const connections = app.get<HostConnectionRepository>(HOST_CONNECTIONS);

    await connections.save(
      HostConnection.linkedFrom({
        workspaceId: WorkspaceId.of(held),
        teamId: TeamId.of(held),
        source: SourceKey.of('slack'),
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
          eq(schema.hostConnection.teamId, held),
          eq(schema.hostConnection.source, 'slack'),
        ),
      );
    const read = await connections.of(TeamId.of(held), SourceKey.of('slack'));

    expect(row?.accessToken).not.toContain('xoxb-sealed-1');
    expect(row?.refreshToken).not.toContain('xoxe-sealed-1');
    expect(read?.accessToken.value).toBe('xoxb-sealed-1');
    expect(read?.refreshToken?.value).toBe('xoxe-sealed-1');
  });
});
