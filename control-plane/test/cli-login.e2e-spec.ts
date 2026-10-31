import { randomUUID } from 'node:crypto';
import type { AppAuth } from '@identity/infrastructure/auth/auth';
import { CLI_CLIENT_ID } from '@identity/infrastructure/auth/auth';
import { AUTH } from '@identity/infrastructure/auth/auth.constants';
import { BetterAuthSessionReader } from '@identity/infrastructure/auth/better-auth.session-reader';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { SESSION_READER } from '@shared-kernel/application/ports/session.port';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served } from './support/app';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

describe('signing in from the command line (e2e)', () => {
  let app: INestApplication;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const requestCode = () =>
    served(app)
      .post('/api/auth/device/code')
      .send({ client_id: CLI_CLIENT_ID });

  const pollFor = (deviceCode: string) =>
    served(app).post('/api/auth/device/token').send({
      grant_type: DEVICE_GRANT,
      device_code: deviceCode,
      client_id: CLI_CLIENT_ID,
    });

  const webSessionOf = async (userId: string) => {
    const context = await app.get<AppAuth>(AUTH).$context;

    return (await context.internalAdapter.createSession(userId)).token;
  };

  const approve = async (userCode: string, userId: string) => {
    const session = await webSessionOf(userId);

    await served(app)
      .get(`/api/auth/device?user_code=${userCode}`)
      .set('Authorization', `Bearer ${session}`)
      .expect(200);
    await served(app)
      .post('/api/auth/device/approve')
      .set('Authorization', `Bearer ${session}`)
      .send({ userCode })
      .expect(200);
  };

  const signIn = async (userId: string) => {
    const code = (await requestCode().expect(200)).body;
    await approve(code.user_code, userId);

    return (await pollFor(code.device_code).expect(200)).body
      .access_token as string;
  };

  beforeAll(async () => {
    app = await openApp((module) =>
      module.overrideProvider(SESSION_READER).useClass(BetterAuthSessionReader),
    );
    workspaceId = `cli-login-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(app.get<DrizzleDatabase>(DRIZZLE), workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
  });

  afterAll(async () => {
    await app
      .get<DrizzleDatabase>(DRIZZLE)
      .delete(schema.oidcTrust)
      .where(eq(schema.oidcTrust.workspaceId, workspaceId));
    await unseat();
    await app.close();
  });

  it('hands out a code that leads the person to the web app to approve it', async () => {
    const { body } = await requestCode().expect(200);

    expect(body.verification_uri).toMatch(/\/device$/);
    expect(body.verification_uri_complete).toContain(
      `user_code=${body.user_code}`,
    );
    expect(body.interval).toBe(5);
  });

  it('does not hand out a code to a client other than the Spotlight CLI', async () => {
    const { body } = await served(app)
      .post('/api/auth/device/code')
      .send({ client_id: 'someone-else' })
      .expect(400);

    expect(body.error).toBe('invalid_client');
  });

  it('does not let the client bind the code to a person or ask for a scope', async () => {
    for (const extra of [{ user_id: owner }, { scope: 'admin' }]) {
      const { body } = await served(app)
        .post('/api/auth/device/code')
        .send({ client_id: CLI_CLIENT_ID, ...extra })
        .expect(400);

      expect(body.error).toBe('invalid_request');
    }
  });

  it('keeps the CLI waiting until the person approves', async () => {
    const code = (await requestCode().expect(200)).body;

    const { body } = await pollFor(code.device_code).expect(400);

    expect(body.error).toBe('authorization_pending');
  });

  it('tells the CLI when the person denies the code', async () => {
    const code = (await requestCode().expect(200)).body;
    const session = await webSessionOf(owner);
    await served(app)
      .get(`/api/auth/device?user_code=${code.user_code}`)
      .set('Authorization', `Bearer ${session}`)
      .expect(200);
    await served(app)
      .post('/api/auth/device/deny')
      .set('Authorization', `Bearer ${session}`)
      .send({ userCode: code.user_code })
      .expect(200);

    const { body } = await pollFor(code.device_code).expect(400);

    expect(body.error).toBe('access_denied');
  });

  it('lets the login act as the person through the resource API, as Terraform does', async () => {
    const login = await signIn(owner);

    const created = await served(app)
      .post(`/api/v1/resources/workspaces/${workspaceId}/oidc-trusts`)
      .set('Authorization', `Bearer ${login}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        key: 'github-main',
        issuer: 'https://token.actions.githubusercontent.com',
        subject: 'repo:acme/platform:ref:refs/heads/main',
        scopes: ['configure', 'secrets'],
      });

    expect(created.status).toBe(201);
    expect(created.body.createdBy).toBe(owner);
  });

  it('lets the login act as the person on a route only people may call', async () => {
    const login = await signIn(owner);

    const { body } = await served(app)
      .get('/api/auth/get-session')
      .set('Authorization', `Bearer ${login}`)
      .expect(200);

    expect(body.user.id).toBe(owner);
  });

  it('stops the login once the person signs out from the CLI', async () => {
    const login = await signIn(owner);

    await served(app)
      .post('/api/auth/sign-out')
      .set('Authorization', `Bearer ${login}`)
      .expect(200);

    const { body } = await served(app)
      .get(`/api/v1/resources/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${login}`)
      .expect(401);

    expect(body.detail ?? body.message).toBe(
      'The token is unknown, expired or revoked.',
    );
  });

  it('turns away a bearer that is neither a workspace token nor a login', async () => {
    await served(app)
      .get(`/api/v1/resources/workspaces/${workspaceId}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});
