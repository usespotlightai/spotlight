import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
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
import * as schema from './support/schema';

type Body = Record<string, unknown> & { id: string; version: number };

const SKILL = {
  key: 'grafana',
  files: {
    'SKILL.md':
      '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch before you guess.',
  },
};

const INTEGRATION = {
  integration: 'linear',
  name: 'Linear',
  actions: {
    comment: {
      request: { method: 'POST', url: 'https://api.linear.app/graphql' },
    },
  },
  tools: {
    comment: { description: 'Comment on an issue', action: 'comment' },
  },
};

const LINE = {
  key: 'delivery',
  name: 'Delivery',
  stations: [
    {
      key: 'backlog',
      name: 'Backlog',
      kind: 'backlog',
      passesTo: ['implementation'],
    },
    {
      key: 'implementation',
      name: 'Implementation',
      harness: 'claude-code',
      prompt: 'Implement the task.',
      tools: ['linear.comment'],
      skills: ['grafana'],
      ends: true,
    },
    { key: 'completed', name: 'Completed', kind: 'completed' },
  ],
};

const eventually = async <T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
): Promise<T> => {
  const until = Date.now() + 20_000;

  for (;;) {
    const value = await read();

    if (done(value) || Date.now() > until) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

describe('a team’s whole configuration, through the resource API (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let owner: string;
  const slugs: string[] = [];

  const api = () => {
    const http = served(app);

    return {
      create: async (path: string, body: object): Promise<Body> => {
        const answer = await http
          .post(`/api/v1/resources/${path}`)
          .set(TEST_USER_HEADER, owner)
          .set('Idempotency-Key', randomUUID())
          .send(body);

        expect(answer.status, JSON.stringify(answer.body)).toBe(201);

        return answer.body;
      },
      read: (path: string) =>
        http.get(`/api/v1/resources/${path}`).set(TEST_USER_HEADER, owner),
      update: (path: string, version: number, body: object) =>
        http
          .put(`/api/v1/resources/${path}`)
          .set(TEST_USER_HEADER, owner)
          .set('If-Match', `"${version}"`)
          .send(body),
      delete: (path: string, version: number) =>
        http
          .delete(`/api/v1/resources/${path}`)
          .set(TEST_USER_HEADER, owner)
          .set('If-Match', `"${version}"`),
    };
  };

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    owner = randomUUID();
    await db
      .insert(schema.user)
      .values({ id: owner, name: 'Ada', email: `${owner}@example.com` });
  });

  afterEach(async () => {
    const workspaces = await db
      .select({ id: schema.workspace.id })
      .from(schema.workspace)
      .where(inArray(schema.workspace.slug, slugs.splice(0)));
    const ids = workspaces.map((each) => each.id);

    if (ids.length > 0) {
      const teams = (
        await db
          .select({ id: schema.team.id })
          .from(schema.team)
          .where(inArray(schema.team.workspaceId, ids))
      ).map((each) => each.id);

      await db.delete(schema.task).where(inArray(schema.task.workspaceId, ids));
      await db.delete(schema.line).where(inArray(schema.line.workspaceId, ids));

      if (teams.length > 0) {
        await db
          .delete(schema.skillDefinition)
          .where(inArray(schema.skillDefinition.teamId, teams));
        await db
          .delete(schema.integrationDefinition)
          .where(inArray(schema.integrationDefinition.teamId, teams));
      }

      await db.delete(schema.team).where(inArray(schema.team.workspaceId, ids));
      await db
        .delete(schema.workspace)
        .where(inArray(schema.workspace.id, ids));
    }

    await db
      .delete(schema.idempotentCreate)
      .where(eq(schema.idempotentCreate.scope, `person:${owner}`));
    await db.delete(schema.user).where(eq(schema.user.id, owner));
  });

  it('creates, reads, changes and deletes everything a team is configured with', async () => {
    const slug = `acme-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);

    const workspace = await api().create('workspaces', { name: 'Acme', slug });
    const team = await api().create(`workspaces/${workspace.id}/teams`, {
      key: 'core',
      name: 'Core',
    });
    const skill = await api().create(`teams/${team.id}/skills`, SKILL);
    const integration = await api().create(
      `teams/${team.id}/integrations`,
      INTEGRATION,
    );
    const line = await api().create(`teams/${team.id}/lines`, LINE);

    expect(
      [workspace, team, skill, integration, line].map((each) => each.address),
    ).toEqual([slug, 'core', 'core/grafana', 'core/linear', 'core/delivery']);
    expect(
      (line.definition as typeof LINE).stations.find(
        (each) => each.key === 'implementation',
      ),
    ).toMatchObject({ tools: ['linear.comment'], skills: ['grafana'] });

    const rejections = await Promise.all([
      api().delete(`workspaces/${workspace.id}`, workspace.version),
      api().delete(`teams/${team.id}`, team.version),
      api().delete(`skills/${skill.id}`, skill.version),
      api().delete(`integrations/${integration.id}`, integration.version),
    ]);

    expect(rejections.map((each) => [each.status, each.body.type])).toEqual(
      rejections.map(() => [409, 'urn:spotlight:problem:in-use']),
    );
    expect(rejections[1]?.body.detail).toMatch(
      /line delivery, skill grafana, integration linear|integration linear, line delivery, skill grafana/,
    );

    const renamed = await api().update(`teams/${team.id}`, team.version, {
      key: 'core',
      name: 'Core platform',
    });
    const updated = await api().update(`lines/${line.id}`, line.version, {
      ...LINE,
      name: 'Shipping',
    });

    expect(renamed.body).toMatchObject({ name: 'Core platform' });
    expect(updated.body).toMatchObject({
      address: 'core/delivery',
      definition: { name: 'Shipping' },
    });

    for (const [path, version] of [
      [`lines/${line.id}`, updated.body.version],
      [`skills/${skill.id}`, skill.version],
      [`integrations/${integration.id}`, integration.version],
      [`teams/${team.id}`, renamed.body.version],
      [`workspaces/${workspace.id}`, workspace.version],
    ] as const) {
      const deleted = await api().delete(path, version);

      expect(deleted.status, `${path}: ${JSON.stringify(deleted.body)}`).toBe(
        204,
      );
      expect((await api().read(path)).status).toBe(404);
    }
  });

  it('imports what a workspace had before Terraform, built-in lines included', async () => {
    const slug = `acme-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);

    const created = await served(app)
      .post('/api/workspaces')
      .set(TEST_USER_HEADER, owner)
      .send({
        name: 'Acme',
        slug,
        teamName: 'Core',
        survey: { jobFunction: 'engineering' },
      });

    expect(created.status).toBe(201);

    const teamId = created.body.teams[0].id as string;
    const lines = await eventually(
      () =>
        db
          .select({ key: schema.line.key })
          .from(schema.line)
          .where(eq(schema.line.teamId, teamId)),
      (value) => value.length > 0,
    );
    const imported = (path: string, address: string) =>
      api().read(`${path}/import?address=${encodeURIComponent(address)}`);

    const workspace = await imported('workspaces', slug);
    const team = await imported(`workspaces/${created.body.id}/teams`, 'core');

    expect(workspace.body).toMatchObject({ id: created.body.id, slug });
    expect(team.body).toMatchObject({ id: teamId, key: 'core' });
    expect(lines.length).toBeGreaterThan(0);

    for (const { key } of lines) {
      const line = await imported(
        `workspaces/${created.body.id}/lines`,
        `core/${key}`,
      );

      expect(line.status).toBe(200);
      expect(line.body).toMatchObject({ key, address: `core/${key}` });

      const unchanged = await api().update(
        `lines/${line.body.id}`,
        line.body.version,
        line.body.definition,
      );

      expect(unchanged.status, JSON.stringify(unchanged.body)).toBe(200);
      expect(unchanged.body.definition).toEqual(line.body.definition);
    }
  });
});
