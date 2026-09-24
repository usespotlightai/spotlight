import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import {
  TEAM_SKILLS,
  type TeamSkillsPort,
} from '@work/application/ports/team-skills.port';
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
import {
  conformsAsResource,
  type ResourceFixture,
} from './support/resource-conformance';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const skillFile = (description: string, body: string) =>
  `---\nname: grafana\ndescription: ${description}\ntools: [grafana.search]\n---\n${body}`;

const GRAFANA = {
  key: 'grafana',
  files: {
    'SKILL.md': skillFile('Look up dashboards', 'Search before you guess.'),
    'queries/latency.promql': 'histogram_quantile(0.99, rate(x[5m]))',
  },
};

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const held = `skills-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, held);

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/teams/${held}/skills`,
    item: (id) => `/api/resources/skills/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${held}/skills/import?address=${encodeURIComponent(address)}`,
    address: 'team/grafana',
    valid: GRAFANA,
    changed: {
      ...GRAFANA,
      files: { 'SKILL.md': skillFile('Look up dashboards', 'Search first.') },
    },
    changedAgain: {
      ...GRAFANA,
      files: { 'SKILL.md': skillFile('Read dashboards', 'Search first.') },
    },
    invalid: {
      body: {
        key: 'grafana',
        files: { 'SKILL.md': '---\nname: grafana\n---\nNo description.' },
      },
      path: 'files["SKILL.md"]',
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
      await seat.unseat();
    },
  };
};

conformsAsResource({ kind: 'skill', open: seated });

describe('a skill, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let fixture: ResourceFixture;
  let teamId: string;

  const create = (body: object) =>
    served(app)
      .post(fixture.collection)
      .set(TEST_USER_HEADER, fixture.admin)
      .set('Idempotency-Key', randomUUID())
      .send(body);

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

  it('says what SKILL.md says it is for and what it uses', async () => {
    const made = await create(GRAFANA);

    expect(made.body).toMatchObject({
      key: 'grafana',
      files: GRAFANA.files,
      description: 'Look up dashboards',
      secrets: [],
      tools: ['grafana.search'],
    });
  });

  it('is laid out for every run that is given it', async () => {
    await create(GRAFANA);

    const ready = await app
      .get<TeamSkillsPort>(TEAM_SKILLS)
      .readyFor(TeamId.of(teamId), ['grafana']);

    expect(ready).toEqual([
      expect.objectContaining({
        skill: expect.objectContaining({ key: 'grafana' }),
        files: expect.arrayContaining([
          expect.objectContaining({ path: 'queries/latency.promql' }),
        ]),
      }),
    ]);
  });

  it('refuses a file outside the skill’s folder', async () => {
    const refused = await create({
      ...GRAFANA,
      files: { ...GRAFANA.files, '../escape.sh': 'rm -rf /' },
    });

    expect(refused.status).toBe(422);
    expect(refused.body.errors).toEqual([
      expect.objectContaining({ path: 'files["../escape.sh"]' }),
    ]);
  });

  it('will not be deleted while a station gives it', async () => {
    const made = await create(GRAFANA);
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const lineId = randomUUID();
    const stationId = randomUUID();

    await db.insert(schema.line).values({
      id: lineId,
      workspaceId: teamId,
      teamId,
      key: 'delivery',
      name: 'Delivery',
    });
    await db.insert(schema.station).values({
      id: stationId,
      lineId,
      key: 'implementation',
      name: 'Implementation',
      position: 0,
    });
    await db
      .insert(schema.stationSkill)
      .values({ stationId, skill: 'grafana', position: 0 });

    const refused = await served(app)
      .delete(fixture.item(made.body.id))
      .set(TEST_USER_HEADER, fixture.admin)
      .set('If-Match', `"${made.body.version}"`);

    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      type: 'urn:spotlight:problem:in-use',
      detail: expect.stringContaining('delivery/implementation'),
    });
    expect(
      await db
        .select({ key: schema.skillDefinition.key })
        .from(schema.skillDefinition)
        .where(eq(schema.skillDefinition.teamId, teamId)),
    ).toEqual([{ key: 'grafana' }]);
  });
});
