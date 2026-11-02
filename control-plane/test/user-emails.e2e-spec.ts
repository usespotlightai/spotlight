import { randomUUID } from 'node:crypto';
import {
  MEMBER_DIRECTORY,
  type MemberDirectoryPort,
} from '@identity/application/ports/member-directory.port';
import {
  USER_EMAIL_MAIL,
  type VerificationToSend,
} from '@identity/application/ports/user-email-mail.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

describe('additional emails (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const sent: VerificationToSend[] = [];
  const workspaceId = `emails-${randomUUID().slice(0, 8)}`;
  const slack = `${randomUUID()}@slack.example.com`;

  const http = () => served(app);
  const as = (user: string) => ({
    get: (path: string) => http().get(path).set(TEST_USER_HEADER, user),
    post: (path: string, body: object = {}) =>
      http().post(path).set(TEST_USER_HEADER, user).send(body),
    delete: (path: string) => http().delete(path).set(TEST_USER_HEADER, user),
  });
  const tokenFor = (email: string) =>
    [...sent].reverse().find((each) => each.to === email)?.token ?? '';
  const matched = (email: string) =>
    app
      .get<MemberDirectoryPort>(MEMBER_DIRECTORY)
      .byEmail(WorkspaceId.of(workspaceId), email);

  beforeAll(async () => {
    app = await openApp((module) =>
      module.overrideProvider(USER_EMAIL_MAIL).useValue({
        send: async (verification: VerificationToSend) => {
          sent.push(verification);
        },
      }),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
    seat = await seatTeam(db, workspaceId);
  });

  afterAll(async () => {
    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, workspaceId));
    await seat.unseat();
    await app.close();
  });

  it('adds an address, sends it a link and lists it as pending', async () => {
    const answer = await as(seat.owner)
      .post('/api/me/emails', { email: slack.toUpperCase() })
      .expect(200);

    expect(answer.body).toMatchObject({ email: slack, status: 'pending' });
    expect(sent[sent.length - 1]?.to).toBe(slack);

    const listed = (await as(seat.owner).get('/api/me/emails').expect(200))
      .body;

    expect(listed.additional).toEqual([
      expect.objectContaining({ email: slack, status: 'pending' }),
    ]);
    expect(await matched(slack)).toBeNull();
  });

  it('sends no second link within a minute', async () => {
    const sentBefore = sent.length;

    await as(seat.owner).post('/api/me/emails', { email: slack }).expect(409);
    expect(sent).toHaveLength(sentBefore);
  });

  it('refuses the sign-in email', async () => {
    const signIn = (await as(seat.owner).get('/api/me/emails').expect(200)).body
      .signInEmail;

    await as(seat.owner).post('/api/me/emails', { email: signIn }).expect(422);
  });

  it('refuses the link when another account opens it', async () => {
    await as(seat.member)
      .post(`/api/me/email-verifications/${tokenFor(slack)}`)
      .expect(403);
  });

  it('verifies the address, and then matches it to the member', async () => {
    const answer = await as(seat.owner)
      .post(`/api/me/email-verifications/${tokenFor(slack)}`)
      .expect(200);

    expect(answer.body).toMatchObject({ email: slack, status: 'verified' });
    expect((await matched(slack.toUpperCase()))?.value).toBe(seat.owner);
  });

  it('keeps the address with the account that verified it first', async () => {
    await as(seat.member).post('/api/me/emails', { email: slack }).expect(200);
    await as(seat.member)
      .post(`/api/me/email-verifications/${tokenFor(slack)}`)
      .expect(409);
    expect((await matched(slack))?.value).toBe(seat.owner);
  });

  it('stops matching a removed address', async () => {
    const [email] = (await as(seat.owner).get('/api/me/emails').expect(200))
      .body.additional;

    await as(seat.owner).delete(`/api/me/emails/${email.id}`).expect(204);
    await as(seat.member).delete(`/api/me/emails/${email.id}`).expect(404);
    expect(await matched(slack)).toBeNull();
  });
});
