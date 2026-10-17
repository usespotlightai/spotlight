import { randomUUID } from 'node:crypto';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { DrizzleWorkspaceRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const workspaceId = `workspaces-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);
  const slug = `acme-${randomUUID().slice(0, 8)}`;

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: '/api/resources/workspaces',
    item: (id) => `/api/resources/workspaces/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/import?address=${encodeURIComponent(address)}`,
    listing: () => '/api/resources/workspaces',
    workspaceOf: (created) => created.id,
    listsAcrossWorkspaces: true,
    address: slug,
    valid: { name: 'Acme', slug },
    changed: { name: 'Acme, again', slug },
    changedAgain: { name: 'Acme, once more', slug },
    invalid: { body: { name: '', slug }, path: 'name' },
    anyoneCreates: true,
    allowViewer: async (created) => {
      await db.insert(schema.workspaceMember).values({
        workspaceId: created.id,
        userId: seat.member,
        role: 'member',
      });
    },
    close: async () => {
      const [made] = await db
        .select({ id: schema.workspace.id })
        .from(schema.workspace)
        .where(eq(schema.workspace.slug, slug));

      if (made) {
        await db
          .delete(schema.team)
          .where(eq(schema.team.workspaceId, made.id));
        await db
          .delete(schema.workspace)
          .where(eq(schema.workspace.id, made.id));
      }

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

conformsAsResource({ kind: 'workspace', open: seated });

describe('a workspace, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let fixture: ResourceFixture;

  const as = (user: string) => ({
    create: (body: object) =>
      served(app)
        .post(fixture.collection)
        .set(TEST_USER_HEADER, user)
        .set('Idempotency-Key', randomUUID())
        .send(body),
    put: (id: string, version: number, body: object) =>
      served(app)
        .put(fixture.item(id))
        .set(TEST_USER_HEADER, user)
        .set('If-Match', `"${version}"`)
        .send(body),
    delete: (id: string, version: number) =>
      served(app)
        .delete(fixture.item(id))
        .set(TEST_USER_HEADER, user)
        .set('If-Match', `"${version}"`),
  });

  beforeAll(async () => {
    app = await openApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    fixture = await seated(app);
  });

  afterEach(async () => {
    await fixture.close();
  });

  it('is owned by whoever created it, and has no team yet', async () => {
    const made = await as(fixture.admin).create(fixture.valid);
    const db = app.get<DrizzleDatabase>(DRIZZLE);

    expect(
      await db
        .select({
          userId: schema.workspaceMember.userId,
          role: schema.workspaceMember.role,
        })
        .from(schema.workspaceMember)
        .where(eq(schema.workspaceMember.workspaceId, made.body.id)),
    ).toEqual([{ userId: fixture.admin, role: 'owner' }]);
    expect(
      await db
        .select()
        .from(schema.team)
        .where(eq(schema.team.workspaceId, made.body.id)),
    ).toEqual([]);
  });

  it('keeps the slug it was created with', async () => {
    const made = await as(fixture.admin).create(fixture.valid);
    const moved = await as(fixture.admin).put(made.body.id, made.body.version, {
      name: 'Acme',
      slug: `${fixture.address}-elsewhere`,
    });

    expect(moved.status).toBe(422);
    expect(moved.body.errors).toEqual([
      expect.objectContaining({ path: 'slug' }),
    ]);
  });

  it('will not be deleted while it has a team', async () => {
    const made = await as(fixture.admin).create(fixture.valid);

    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const teamId = randomUUID();

    await db.insert(schema.team).values({
      id: teamId,
      workspaceId: made.body.id,
      key: 'core',
      name: 'Core',
    });
    await db
      .insert(schema.teamMember)
      .values({ teamId, userId: fixture.admin });

    const rejected = await as(fixture.admin).delete(
      made.body.id,
      made.body.version,
    );

    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({
      type: 'urn:spotlight:problem:in-use',
      detail: expect.stringContaining('core'),
    });
  });

  it('will not be deleted under a team even past the check before writing', async () => {
    const made = await as(fixture.admin).create(fixture.valid);
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const workspaces = app.get(DrizzleWorkspaceRepository);
    const teamId = randomUUID();
    const existing = await workspaces.find(WorkspaceId.of(made.body.id));

    await db.insert(schema.team).values({
      id: teamId,
      workspaceId: made.body.id,
      key: 'core',
      name: 'Core',
    });

    await expect(
      workspaces.save(
        existing?.delete(
          [],
          [],
          [],
          [],
          Dependents.none(),
          attributedIn(made.body.id),
        ) as Workspace,
      ),
    ).rejects.toThrow(WorkspaceInUseError);
  });
});
