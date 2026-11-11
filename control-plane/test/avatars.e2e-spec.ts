import { randomUUID } from 'node:crypto';

import type { AvatarImageDto } from '@identity/application/dto/avatar-image.dto';
import {
  AVATAR_IMAGES,
  type AvatarImagesPort,
} from '@identity/application/ports/avatar-images.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const OTHER_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 2,
]);

const stored = new Map<string, AvatarImageDto>();

const keyOf = (...parts: Parameters<AvatarImagesPort['read']>) =>
  `${parts[0].toString()}/${parts[1].value}`;

const images: AvatarImagesPort = {
  put: async (owner, imageId, image) =>
    void stored.set(keyOf(owner, imageId), {
      bytes: image.bytes,
      contentType: image.contentType,
    }),
  read: async (owner, imageId) => stored.get(keyOf(owner, imageId)) ?? null,
  remove: async (owner, imageId) => void stored.delete(keyOf(owner, imageId)),
  removeAllOfTeam: async () => {},
  removeAllIn: async () => {},
};

describe('avatars (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const id = `avatars-${randomUUID().slice(0, 8)}`;

  const as = (userId: string) => ({
    get: (path: string) => served(app).get(path).set(TEST_USER_HEADER, userId),
    put: (path: string, image: Buffer) =>
      served(app)
        .put(path)
        .set(TEST_USER_HEADER, userId)
        .send({ contentType: 'image/png', data: image.toString('base64') }),
    delete: (path: string) =>
      served(app).delete(path).set(TEST_USER_HEADER, userId),
  });

  const workspaceOf = async (userId: string) =>
    (await as(userId).get(`/api/workspaces/${id}`).expect(200)).body as {
      avatarUrl: string | null;
      teams: { id: string; avatarUrl: string | null }[];
    };

  beforeAll(async () => {
    app = await openApp((module) =>
      module.overrideProvider(AVATAR_IMAGES).useValue(images),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
    seat = await seatTeam(db, id);
  });

  afterAll(async () => {
    await db.delete(schema.avatar).where(eq(schema.avatar.workspaceId, id));
    await seat.unseat();
    await app.close();
  });

  it('shows a workspace avatar to its members', async () => {
    const set = await as(seat.owner)
      .put(`/api/workspaces/${id}/avatar`, PNG)
      .expect(200);

    const { avatarUrl } = await workspaceOf(seat.member);
    expect(avatarUrl).toMatch(
      new RegExp(`^/api/workspaces/${id}/avatar/[0-9a-f]{64}$`),
    );
    expect(set.body).toEqual({ avatarUrl });

    const image = await as(seat.member)
      .get(avatarUrl ?? '')
      .buffer(true)
      .expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cache-control']).toContain('immutable');
    expect(Buffer.from(image.body as Buffer)).toEqual(PNG);
  });

  it('keeps the Terraform version of a team when its avatar changes', async () => {
    const versionOfTeam = async () =>
      (
        (await as(seat.owner).get(`/api/v1/resources/teams/${id}`).expect(200))
          .body as { version: number }
      ).version;
    const before = await versionOfTeam();

    await as(seat.owner).put(`/api/teams/${id}/avatar`, PNG).expect(200);

    expect(await versionOfTeam()).toBe(before);

    const [team] = (await workspaceOf(seat.member)).teams;
    expect(team?.avatarUrl).toMatch(
      new RegExp(`^/api/teams/${id}/avatar/[0-9a-f]{64}$`),
    );
  });

  it('finds no image a replaced avatar showed, and removes it', async () => {
    const { avatarUrl: first } = await workspaceOf(seat.owner);

    await as(seat.owner)
      .put(`/api/workspaces/${id}/avatar`, OTHER_PNG)
      .expect(200);

    const { avatarUrl: second } = await workspaceOf(seat.owner);
    expect(second).not.toBe(first);
    await as(seat.owner)
      .get(first ?? '')
      .expect(404);
    await as(seat.owner)
      .get(second ?? '')
      .expect(200);
    await eventually(async () => stored.size === 2);
  });

  it('writes nothing when the image is the one shown', async () => {
    const { avatarUrl } = await workspaceOf(seat.owner);
    const before = stored.size;

    const again = await as(seat.owner)
      .put(`/api/workspaces/${id}/avatar`, OTHER_PNG)
      .expect(200);

    expect(again.body).toEqual({ avatarUrl });
    expect(stored.size).toBe(before);
  });

  it('finds nothing for a digest that is not one', async () => {
    await as(seat.owner).get(`/api/workspaces/${id}/avatar/nope`).expect(404);
  });

  it('lets only somebody who configures the workspace change it', async () => {
    await as(seat.member).put(`/api/workspaces/${id}/avatar`, PNG).expect(403);
    await as(seat.member).delete(`/api/teams/${id}/avatar`).expect(403);
  });

  it('refuses bytes that are not the image they claim to be', async () => {
    await served(app)
      .put(`/api/workspaces/${id}/avatar`)
      .set(TEST_USER_HEADER, seat.owner)
      .send({
        contentType: 'image/png',
        data: Buffer.from('<svg/>').toString('base64'),
      })
      .expect(422);
  });

  it('shows initials again once the avatar is removed', async () => {
    await as(seat.owner).delete(`/api/teams/${id}/avatar`).expect(204);
    await as(seat.owner).delete(`/api/teams/${id}/avatar`).expect(204);

    const [team] = (await workspaceOf(seat.owner)).teams;
    expect(team?.avatarUrl).toBeNull();
    await eventually(async () => stored.size === 1);
  });
});
