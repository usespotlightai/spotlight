import { randomUUID } from 'node:crypto';

import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import {
  INTEGRATION_CONNECTIONS,
  type IntegrationConnectionRepository,
} from '@integrations/domain/repositories/integration-connection.repository';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { OAuth2State } from '@integrations/infrastructure/integrations/oauth2-state';
import type { INestApplication } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  INTEGRATION_TOOL_CALLS,
  type IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';
import { eq, inArray } from 'drizzle-orm';
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

import { type Answer, openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const LINEAR = {
  integration: 'linear',
  name: 'Linear',
  connection: {
    actsAs: 'requester',
    oauth2: {
      authorize: 'https://linear.app/oauth/authorize',
      token: 'https://api.linear.app/oauth/token',
    },
  },
  actions: {
    comment: {
      request: {
        method: 'POST',
        url: 'https://api.linear.app/graphql',
        auth: { oauth2: { connection: true } },
        // oxlint-disable-next-line no-template-curly-in-string -- the file's own expression syntax
        body: { body: '${{ inputs.body }}' },
      },
    },
  },
  tools: {
    comment: {
      action: 'comment',
      description: 'Comment on the Linear issue as whoever started the task',
      inputs: { body: { required: true } },
    },
  },
};

interface Connections {
  readonly mine: readonly { readonly tools: unknown }[];
  readonly people:
    | readonly { readonly name: string; readonly linkedAccount: string }[]
    | null;
}

describe('each person’s own connections (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;

  const as = (viewer: string) => ({
    get: (path: string) => served(app).get(path).set(TEST_USER_HEADER, viewer),
    post: (path: string, body: object) =>
      served(app)
        .post(path)
        .set(TEST_USER_HEADER, viewer)
        .set('Idempotency-Key', randomUUID())
        .send(body),
    delete: (path: string) =>
      served(app).delete(path).set(TEST_USER_HEADER, viewer),
    put: (path: string, body: object) =>
      served(app).put(path).set(TEST_USER_HEADER, viewer).send(body),
  });

  const resolving = (requester: string) =>
    app.get<IntegrationToolCallsPort>(INTEGRATION_TOOL_CALLS).resolve(
      'linear.comment',
      {
        taskId: 'task_1',
        workspaceId,
        teamId: workspaceId,
        title: 'Drain the queue',
        pullRequests: [],
        line: 'delivery',
        station: 'Implementation',
        stationKey: 'implementation',
        marks: {},
        waiting: null,
      },
      { runId: 'run_1', attempt: 1 },
      requester,
    );

  const connect = (personId: string, linkedAccount: string) =>
    app.get<IntegrationConnectionRepository>(INTEGRATION_CONNECTIONS).save(
      IntegrationConnection.connectFrom({
        workspaceId: WorkspaceId.of(workspaceId),
        teamId: TeamId.of(workspaceId),
        integration: IntegrationKey.of('linear'),
        owner: ConnectionOwner.person(UserId.of(personId)),
        tokens: OAuthTokens.of({
          accessToken: `lin-${personId}`,
          linkedAccount,
        }),
        at: new Date('2026-09-01T00:00:00.000Z'),
      }),
    );

  beforeAll(async () => {
    vi.stubEnv('OAUTH_CLIENTS', '{"linear":{"id":"c-1","secret":"s-1"}}');
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    workspaceId = `connections-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, workspaceId);

    await as(seat.owner)
      .post(`/api/v1/resources/teams/${workspaceId}/integrations`, LINEAR)
      .expect(201);
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
      .delete(schema.personToolPolicy)
      .where(eq(schema.personToolPolicy.teamId, workspaceId));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await seat.unseat();
  });

  it('lets a member who is no admin begin connecting their own account, returning to where they started', async () => {
    const started = (await as(seat.member).post(
      `/api/teams/${workspaceId}/integrations/linear/connect`,
      { actsAs: 'requester', returnTo: `/w/${workspaceId}/inbox/task_1` },
    )) as Answer<{ readonly url: string }>;

    expect(started.status).toBe(201);
    const url = new URL(started.body.url);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');

    const state = new OAuth2State(app.get<Env>(ENV).BETTER_AUTH_SECRET).open(
      url.searchParams.get('state') ?? '',
    );
    expect(state).toMatchObject({
      owner: 'person',
      by: seat.member,
      returnTo: `/w/${workspaceId}/inbox/task_1`,
    });
  });

  it('keeps a member who is no admin from connecting the team', async () => {
    const started = await as(seat.member).post(
      `/api/teams/${workspaceId}/integrations/linear/connect`,
      {},
    );

    expect(started.status).toBe(404);
  });

  it('shows a member their own connections, and an admin who has connected what', async () => {
    await connect(seat.member, '@bea');
    await connect(seat.owner, '@ada');

    const theirs = (await as(seat.member).get(
      `/api/teams/${workspaceId}/connections`,
    )) as Answer<Connections>;
    const roster = (await as(seat.owner).get(
      `/api/teams/${workspaceId}/connections`,
    )) as Answer<Connections>;

    expect(theirs.status).toBe(200);
    expect(theirs.body.mine).toEqual([
      expect.objectContaining({ integration: 'linear', linkedAccount: '@bea' }),
    ]);
    expect(theirs.body.people).toBeNull();
    expect(
      roster.body.people?.map((each) => [each.name, each.linkedAccount]),
    ).toEqual(
      expect.arrayContaining([
        ['Ada', '@ada'],
        ['Bea', '@bea'],
      ]),
    );
    expect(JSON.stringify(roster.body)).not.toContain('lin-');
  });

  it('lets a person disconnect only their own connection', async () => {
    await connect(seat.member, '@bea');
    await connect(seat.owner, '@ada');

    const gone = await as(seat.member).delete(
      `/api/teams/${workspaceId}/integrations/linear/connections/mine`,
    );
    const roster = (await as(seat.owner).get(
      `/api/teams/${workspaceId}/connections`,
    )) as Answer<Connections>;

    expect(gone.status).toBe(204);
    expect(roster.body.people?.map((each) => each.linkedAccount)).toEqual([
      '@ada',
    ]);
  });

  it('lets a person set a rule for calls made with their own connection, and carries it to the tool', async () => {
    await connect(seat.member, '@bea');
    await connect(seat.owner, '@ada');
    const rule = `/api/teams/${workspaceId}/integrations/linear/connections/mine/tools/linear.comment`;

    expect(
      (await as(seat.member).put(rule, { rule: 'needs-approval' })).status,
    ).toBe(204);

    const theirs = (await as(seat.member).get(
      `/api/teams/${workspaceId}/connections`,
    )) as Answer<Connections>;
    const mine = (await as(seat.owner).get(
      `/api/teams/${workspaceId}/connections`,
    )) as Answer<Connections>;
    expect(theirs.body.mine[0].tools).toEqual([
      { tool: 'linear.comment', rule: 'needs-approval' },
    ]);
    expect(mine.body.mine[0].tools).toEqual([
      { tool: 'linear.comment', rule: 'allowed' },
    ]);

    expect((await resolving(seat.member))?.personRule).toEqual({
      rule: 'needs-approval',
      personId: seat.member,
      personName: 'Bea',
    });
    expect((await resolving(seat.owner))?.personRule).toBeNull();
  });

  it('rejects a rule that is not one, and a tool the integration does not offer', async () => {
    await connect(seat.member, '@bea');
    const mine = `/api/teams/${workspaceId}/integrations/linear/connections/mine/tools`;

    expect(
      (
        await as(seat.member).put(`${mine}/linear.comment`, {
          rule: 'sometimes',
        })
      ).status,
    ).toBe(422);
    expect(
      (await as(seat.member).put(`${mine}/linear.archive`, { rule: 'blocked' }))
        .status,
    ).toBe(404);
    expect(
      (
        await as(randomUUID()).put(`${mine}/linear.comment`, {
          rule: 'blocked',
        })
      ).status,
    ).toBe(404);
  });

  it('shows nothing to someone off the team', async () => {
    expect(
      (await as(randomUUID()).get(`/api/teams/${workspaceId}/connections`))
        .status,
    ).toBe(404);
  });
});
