import {
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  type KeyObject,
  randomUUID,
} from 'node:crypto';
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
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const HOST = 'host-egress-e2e-1';

const IMAGE = 'ghcr.io/acme/runner:main';

const VALUE = 'lin_api_e2e_egress';

const TOKEN = `${'e'.repeat(8)}${randomUUID().replaceAll('-', '')}`;

const recipient = () => {
  const pair = generateKeyPairSync('x25519');
  const raw = Buffer.from(
    pair.publicKey.export({ format: 'jwk' }).x ?? '',
    'base64url',
  );

  return { privateKey: pair.privateKey, raw, written: raw.toString('base64') };
};

const opened = (
  sealed: string,
  to: { privateKey: KeyObject; raw: Buffer },
  runId: string,
  secret: string,
): string => {
  const [, ephemeral, iv, tag, encrypted] = sealed.split('.');
  const ephemeralRaw = Buffer.from(ephemeral ?? '', 'base64');
  const shared = diffieHellman({
    privateKey: to.privateKey,
    publicKey: createPublicKey({
      key: { kty: 'OKP', crv: 'X25519', x: ephemeralRaw.toString('base64url') },
      format: 'jwk',
    }),
  });
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(
      hkdfSync(
        'sha256',
        shared,
        Buffer.concat([ephemeralRaw, to.raw]),
        'spotlight:egress-seal:v1',
        32,
      ),
    ),
    Buffer.from(iv ?? '', 'base64'),
  );
  decipher.setAAD(
    Buffer.from(['spotlight:egress:v1', runId, secret].join('\u0000')),
  );
  decipher.setAuthTag(Buffer.from(tag ?? '', 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted ?? '', 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

describe('egress redeeming a run’s secrets (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let held: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const setSecret = (body: object) =>
    http()
      .post(`/api/resources/workspaces/${held}/secrets`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(201);

  const queue = async (wears: readonly string[]) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      id,
      workspaceId: held,
      harness: 'dev',
      state: 'queued',
      placement: [['linux']],
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        continuity: { key: `task:${id}` },
        wears,
      },
    });

    return id;
  };

  const claimed = async () => {
    await http()
      .put(`/api/hosts/${HOST}`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        session: 'session_1',
        name: 'build-box',
        release: '0.1.0',
        executor: 'docker',
        capacity: 1,
        running: [],
        images: [
          { image: IMAGE, usual: true, harnesses: [{ id: 'dev', models: [] }] },
        ],
      })
      .expect(200);

    return (
      await http()
        .post('/api/hosts/claim')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ host: HOST, image: IMAGE })
        .expect(200)
    ).body as {
      token: string;
      egressToken: string;
      work: { run: { id: string } };
    };
  };

  const redeem = (token: string, with_: string) =>
    http()
      .post('/api/egress/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipient: with_ });

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    held = `egress-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, held);
    owner = seat.owner;
    unseat = seat.unseat;

    await http()
      .post(`/api/resources/workspaces/${held}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'hosts', labels: ['linux'], token: TOKEN })
      .expect(201);
    await setSecret({
      name: 'LINEAR_API_KEY',
      bindings: [{ host: 'mcp.linear.app', prefix: 'Bearer ' }],
      valueWo: VALUE,
      valueWoVersion: 1,
    });
    await setSecret({
      name: 'SENTRY_TOKEN',
      source: {
        kind: 'aws-secrets-manager',
        secretId: 'sentry-token',
        field: 'token',
      },
      bindings: [{ host: 'sentry.io', name: 'x-sentry-token' }],
    });
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, held));
    await db.delete(schema.run).where(eq(schema.run.workspaceId, held));
    await db.delete(schema.secret).where(eq(schema.secret.workspaceId, held));
    await db
      .delete(schema.runGrants)
      .where(eq(schema.runGrants.workspaceId, held));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, held));
    await forgetRunnersOf(db, held);
    await unseat();
  });

  it('hands the host a credential for egress apart from the runner’s own', async () => {
    await queue([]);

    const work = await claimed();

    expect(work.egressToken).toEqual(expect.any(String));
    expect(work.egressToken).not.toBe(work.token);
    await redeem(work.token, recipient().written).expect(401);
  });

  it('redeems what the run wears: a value Spotlight keeps sealed to egress, one kept elsewhere as where egress reads it', async () => {
    const runId = await queue(['LINEAR_API_KEY', 'SENTRY_TOKEN', 'NOWHERE']);
    const work = await claimed();
    const to = recipient();

    const redeemed = await redeem(work.egressToken, to.written).expect(200);

    expect(redeemed.body).toMatchObject({
      runId,
      reaches: [expect.any(String)],
      withheld: [
        {
          secret: 'NOWHERE',
          reason: expect.stringContaining('Secret NOWHERE not found'),
        },
      ],
    });
    const [linear, sentry] = redeemed.body.secrets;
    expect(linear).toMatchObject({
      secret: 'LINEAR_API_KEY',
      host: 'mcp.linear.app',
      carrier: 'header',
      name: 'authorization',
      prefix: 'Bearer ',
      readInNetwork: null,
    });
    expect(JSON.stringify(redeemed.body)).not.toContain(VALUE);
    expect(opened(linear.sealed, to, runId, 'LINEAR_API_KEY')).toBe(VALUE);
    expect(sentry).toMatchObject({
      secret: 'SENTRY_TOKEN',
      host: 'sentry.io',
      carrier: 'header',
      name: 'x-sentry-token',
      sealed: null,
      readInNetwork: {
        kind: 'aws-secrets-manager',
        secretId: 'sentry-token',
        field: 'token',
      },
    });

    const grants = await db
      .select({ host: schema.secretGrant.host })
      .from(schema.secretGrant)
      .where(eq(schema.secretGrant.runId, runId));
    expect(grants.map((each) => each.host).sort()).toEqual([
      'mcp.linear.app',
      'sentry.io',
    ]);
  });

  it('seals nothing to what is not a key, and grants nothing, whatever the run wears', async () => {
    const runId = await queue(['SENTRY_TOKEN']);
    const work = await claimed();

    await redeem(work.egressToken, 'not-a-key').expect(422);
    await expect(
      db
        .select()
        .from(schema.secretGrant)
        .where(eq(schema.secretGrant.runId, runId)),
    ).resolves.toEqual([]);
  });

  it('seals a run’s secrets to the recipient it first redeemed for, again on a retry, and to no other', async () => {
    await queue(['LINEAR_API_KEY']);
    const work = await claimed();
    const to = recipient();

    await redeem(work.egressToken, to.written).expect(200);
    const again = await redeem(work.egressToken, to.written).expect(200);

    expect(again.body.secrets).toHaveLength(1);
    await redeem(work.egressToken, recipient().written).expect(409);
  });

  it('redeems afresh for the run’s next attempt once its lease lapses, sealed to that attempt’s own egress alone', async () => {
    const runId = await queue(['LINEAR_API_KEY']);
    const first = await claimed();
    await redeem(first.egressToken, recipient().written).expect(200);

    await db
      .update(schema.run)
      .set({ leaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.run.id, runId));

    const second = await claimed();
    const to = recipient();

    expect(second.work.run.id).toBe(runId);

    const redeemed = await redeem(second.egressToken, to.written).expect(200);

    expect(redeemed.body.runId).toBe(runId);
    expect(redeemed.body.secrets).toHaveLength(1);
    expect(
      opened(redeemed.body.secrets[0].sealed, to, runId, 'LINEAR_API_KEY'),
    ).toBe(VALUE);
    await redeem(second.egressToken, to.written).expect(200);
    await redeem(second.egressToken, recipient().written).expect(409);

    const [kept] = await db
      .select({ attempt: schema.runGrants.attempt })
      .from(schema.runGrants)
      .where(eq(schema.runGrants.runId, runId));
    expect(kept?.attempt).toBe(2);
  });

  it('refuses egress once its run has ended, and the run’s grants go with it', async () => {
    const runId = await queue(['LINEAR_API_KEY']);
    const work = await claimed();
    await redeem(work.egressToken, recipient().written).expect(200);

    await http()
      .post(`/api/runs/${runId}/completion`)
      .set('Authorization', `Bearer ${work.token}`)
      .send({ exitCode: 0, failed: false })
      .expect(200);

    await eventually(async () => {
      const answer = await redeem(work.egressToken, recipient().written);
      const grants = await db
        .select()
        .from(schema.secretGrant)
        .where(eq(schema.secretGrant.runId, runId));

      return answer.status === 401 && grants.length === 0;
    });
  });
});
