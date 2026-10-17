import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { ReadyProfileMapper } from '@work/application/mappers/ready-profile.mapper';
import {
  HARNESS_LAUNCH,
  type HarnessLaunchPort,
} from '@work/application/ports/harness-launch.port';
import {
  STATION_PROFILES,
  type StationProfilesPort,
} from '@work/application/ports/station-profiles.port';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { eq, inArray } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { definitionOf } from './support/line-definition';
import {
  conformsAsResource,
  type ResourceFixture,
} from './support/resource-conformance';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const CAREFUL = {
  key: 'careful',
  permissions: {
    allow: ['read', 'edit', 'execute(npm test *)'],
    ask: ['execute(git push *)'],
    deny: ['read(.env)'],
  },
  mcpServers: [
    {
      name: 'linear',
      command: 'npx',
      args: ['-y', 'linear-mcp'],
      env: { LINEAR_TEAM: 'core' },
    },
  ],
  native: {
    'claude-code': { includeCoAuthoredBy: false, env: { FOO: 'bar' } },
    codex: 'model_verbosity = "low"\n',
  },
};

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const workspaceId = `profiles-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/teams/${workspaceId}/harness-profiles`,
    item: (id) => `/api/resources/harness-profiles/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${workspaceId}/harness-profiles/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) =>
      `/api/resources/workspaces/${workspaceId}/harness-profiles`,
    workspaceOf: () => workspaceId,
    address: 'team/careful',
    valid: CAREFUL,
    changed: {
      ...CAREFUL,
      permissions: {
        ...CAREFUL.permissions,
        deny: ['read(.env)', 'edit(.github/**)'],
      },
    },
    changedAgain: { ...CAREFUL, native: {} },
    invalid: {
      body: {
        ...CAREFUL,
        permissions: { ...CAREFUL.permissions, deny: ['launch(rockets)'] },
      },
      path: 'permissions.deny[0]',
    },
    close: async () => {
      await db
        .delete(schema.idempotentCreate)
        .where(
          inArray(schema.idempotentCreate.scope, [
            `person:${seat.owner}`,
            `person:${seat.member}`,
          ]),
        );
      await db
        .delete(schema.configurationChange)
        .where(eq(schema.configurationChange.workspaceId, workspaceId));
      await db
        .delete(schema.workspaceToken)
        .where(eq(schema.workspaceToken.workspaceId, workspaceId));
      await seat.unseat();
    },
  };
};

conformsAsResource({ kind: 'harness-profile', open: seated });

describe('a harness profile, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let fixture: ResourceFixture;
  let teamId: string;

  const as = (user: string) => ({
    create: (path: string, body: object) =>
      served(app)
        .post(path)
        .set(TEST_USER_HEADER, user)
        .set('Idempotency-Key', randomUUID())
        .send(body),
    read: (path: string) => served(app).get(path).set(TEST_USER_HEADER, user),
  });

  const create = (body: object) =>
    as(fixture.admin).create(fixture.collection, body);

  const delivery = () => {
    const line = definitionOf(BUILT_IN_LINES[0] as LineOpening);
    const worked = line.stations.filter((each) => each.kind === 'work');
    const [first, second] = worked.map((each) => each.key);

    return {
      ...line,
      stations: line.stations.map((station) =>
        station.key === first
          ? { ...station, harness: 'claude-code', profile: 'careful' }
          : station.key === second
            ? { ...station, harness: 'cursor', profile: 'careful' }
            : station,
      ),
      first,
      second,
    };
  };

  beforeAll(async () => {
    app = await openApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    fixture = await seated(app);
    teamId = fixture.collection.split('/')[4] ?? '';
  });

  afterEach(async () => {
    await fixture.close();
  });

  it('reads back as it was written, with what each harness cannot say of it as warnings', async () => {
    const made = await create(CAREFUL);

    expect(made.status).toBe(201);
    expect(made.body).toMatchObject(CAREFUL);
    expect(made.body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'permissions.ask[0]',
          message: expect.stringContaining('Cursor has no ask rules'),
        }),
        expect.objectContaining({
          path: 'permissions.deny[0]',
          message: expect.stringContaining('Codex reads whatever'),
        }),
      ]),
    );
  });

  it('refuses native settings for a harness Spotlight does not run', async () => {
    const refused = await create({ ...CAREFUL, native: { aider: {} } });

    expect(refused.status).toBe(422);
    expect(refused.body.errors).toEqual([
      expect.objectContaining({ path: 'native.aider' }),
    ]);
  });

  it('refuses Codex settings that do not read as TOML', async () => {
    const refused = await create({ ...CAREFUL, native: { codex: 'model =' } });

    expect(refused.status).toBe(422);
    expect(refused.body.errors).toEqual([
      expect.objectContaining({ path: 'native.codex' }),
    ]);
  });

  it('refuses one rule said two ways', async () => {
    const refused = await create({
      ...CAREFUL,
      permissions: { allow: ['execute'], ask: [], deny: ['execute'] },
    });

    expect(refused.status).toBe(422);
    expect(refused.body.errors).toEqual([
      expect.objectContaining({ path: 'permissions.deny[0]' }),
    ]);
  });

  it('drives two harnesses on two stations of one line', async () => {
    await create(CAREFUL);
    const { first, second, ...line } = delivery();
    const laid = await as(fixture.admin).create(
      `/api/resources/teams/${teamId}/lines`,
      line,
    );

    expect(laid.status).toBe(201);
    expect(laid.body.definition.stations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: first, profile: 'careful' }),
        expect.objectContaining({ key: second, profile: 'careful' }),
      ]),
    );

    const stored = await app
      .get<StationProfilesPort>(STATION_PROFILES)
      .named(TeamId.of(teamId), 'careful');
    const profile = stored ? ReadyProfileMapper.toReady(stored) : null;
    const launch = app.get<HarnessLaunchPort>(HARNESS_LAUNCH);
    const on = (harness: string) =>
      launch.preparedFor(HarnessId.of(harness), {
        model: null,
        effort: null,
        profile,
      })?.setup;

    const claude = on('claude-code');
    const cursor = on('cursor');

    expect(claude?.asks).toEqual(['execute']);
    expect(cursor?.asks).toEqual(['execute']);
    expect(
      JSON.parse(
        claude?.files.find((each) => each.path === 'claude/settings.json')
          ?.text ?? '{}',
      ),
    ).toMatchObject({ includeCoAuthoredBy: false, env: { FOO: 'bar' } });
    expect(cursor?.files.map((each) => each.path)).toEqual([
      'cursor/cli-config.json',
      'cursor/mcp.json',
    ]);
  });

  it('is defined and deleted by a configure token, recorded as that token, and only read with a read token', async () => {
    const issue = async (scopes: readonly string[]) =>
      (
        await as(fixture.admin).create(
          `/api/resources/workspaces/${teamId}/tokens`,
          { name: scopes.join('-'), scopes },
        )
      ).headers['spotlight-workspace-token'] as string;
    const bearing = (token: string) => ({
      create: () =>
        served(app)
          .post(fixture.collection)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', randomUUID())
          .send(CAREFUL),
      read: (id: string) =>
        served(app)
          .get(fixture.item(id))
          .set('Authorization', `Bearer ${token}`),
      delete: (id: string, version: number) =>
        served(app)
          .delete(fixture.item(id))
          .set('Authorization', `Bearer ${token}`)
          .set('If-Match', `"${version}"`),
    });
    const configure = bearing(await issue(['configure']));
    const read = bearing(await issue(['read']));

    const made = await configure.create();
    const refused = await read.create();
    const seen = await read.read(made.body.id);
    const kept = await read.delete(made.body.id, made.body.version);
    const removed = await configure.delete(made.body.id, made.body.version);
    const changes = (
      await as(fixture.admin).read(
        `/api/workspaces/${teamId}/configuration-changes`,
      )
    ).body as { resource: string; action: string; by: { kind: string } }[];

    expect([made.status, seen.status, removed.status]).toEqual([201, 200, 204]);
    expect([refused.status, kept.status]).toEqual([403, 403]);
    expect(refused.body.type).toBe('urn:spotlight:problem:forbidden');
    expect(
      changes
        .filter((each) => each.resource === 'harness-profile')
        .map((each) => [each.action, each.by.kind]),
    ).toEqual([
      ['deleted', 'token'],
      ['created', 'token'],
    ]);
  });

  describe('wearing a secret in an MCP server’s env', () => {
    const WEARING = {
      ...CAREFUL,
      mcpServers: [
        {
          name: 'linear',
          command: 'npx',
          args: ['-y', 'linear-mcp'],
          env: { LINEAR_TEAM: 'core', LINEAR_API_KEY: 'secret.LINEAR_API_KEY' },
        },
      ],
    };

    const setSecret = () =>
      as(fixture.admin).create(`/api/resources/workspaces/${teamId}/secrets`, {
        name: 'LINEAR_API_KEY',
        bindings: [{ host: 'mcp.linear.app', prefix: 'Bearer ' }],
        valueWo: 'lin_api_profile_e2e',
        valueWoVersion: 1,
      });

    afterEach(async () => {
      const db = app.get<DrizzleDatabase>(DRIZZLE);
      await db
        .delete(schema.harnessProfile)
        .where(eq(schema.harnessProfile.teamId, teamId));
      await db
        .delete(schema.secret)
        .where(eq(schema.secret.workspaceId, teamId));
      await db
        .delete(schema.secretDataKey)
        .where(eq(schema.secretDataKey.workspaceId, teamId));
    });

    it('refuses a secret the workspace does not have, where it is named', async () => {
      const refused = await create(WEARING);

      expect(refused.status).toBe(422);
      expect(refused.body.errors).toEqual([
        expect.objectContaining({
          path: 'mcpServers[0].env.LINEAR_API_KEY',
          message: expect.stringContaining('LINEAR_API_KEY'),
        }),
      ]);
    });

    it('hands the run a stand-in for it, never its value, and keeps the secret from being deleted', async () => {
      const secret = await setSecret();
      expect(secret.status).toBe(201);

      const made = await create(WEARING);
      expect(made.status).toBe(201);
      expect(made.body.mcpServers[0].env.LINEAR_API_KEY).toBe(
        'secret.LINEAR_API_KEY',
      );

      const stored = await app
        .get<StationProfilesPort>(STATION_PROFILES)
        .named(TeamId.of(teamId), 'careful');
      const ready = stored ? ReadyProfileMapper.toReady(stored) : null;
      expect(ready?.wears.map((each) => each.value)).toEqual([
        'LINEAR_API_KEY',
      ]);
      expect(ready?.mcpServers[0]?.env).toEqual({
        LINEAR_TEAM: 'core',
        LINEAR_API_KEY: 'spotlight-egress:LINEAR_API_KEY',
      });

      const refused = await served(app)
        .delete(`/api/resources/secrets/${secret.body.id}`)
        .set(TEST_USER_HEADER, fixture.admin)
        .set('If-Match', `"${secret.body.version}"`);

      expect(refused.status).toBe(409);
      expect(refused.body.detail).toContain('harness profile team/careful');
    });
  });

  it('will not be deleted while a station names it', async () => {
    const made = await create(CAREFUL);
    const { first, second: _second, ...line } = delivery();
    await as(fixture.admin).create(
      `/api/resources/teams/${teamId}/lines`,
      line,
    );

    const refused = await served(app)
      .delete(fixture.item(made.body.id))
      .set(TEST_USER_HEADER, fixture.admin)
      .set('If-Match', `"${made.body.version}"`);

    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      type: 'urn:spotlight:problem:in-use',
      detail: expect.stringContaining(`${line.key}/${first}`),
    });
  });
});
