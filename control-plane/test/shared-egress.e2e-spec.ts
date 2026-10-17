import {
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  type KeyObject,
  randomUUID,
} from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { EGRESS_TOKEN_HEADER } from '@runners/presentation/http/controllers/egress-resource.controller';
import {
  DrizzleRunConnections,
  MAX_WENT_WRONG_FOR_A_RUN,
} from '@work/infrastructure/persistence/drizzle/ledgers/run-connections.ledger';
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

const HARNESSES = [{ id: 'dev', models: [] }];

const SECRET = `whsec_${Buffer.from('s'.repeat(32)).toString('base64')}`;

const VALUE = 'lin_api_e2e_shared_egress';

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

const listening = async (): Promise<{
  server: Server;
  url: string;
  bodies: string[];
}> => {
  const bodies: string[] = [];
  const server = createServer((request, response) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      bodies.push(body);
      response.statusCode = 202;
      response.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/runs`,
    bodies,
  };
};

describe('a push pool that goes out through a shared egress (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;
  let endpoint: Awaited<ReturnType<typeof listening>>;
  let egressId: string;
  let egressToken: string;

  const http = () => served(app);

  const created = (collection: string, body: object) =>
    http()
      .post(`/api/resources/workspaces/${workspaceId}/${collection}`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  const asEgress = (path: string, body: object, token = egressToken) =>
    http()
      .post(`/api/egress/${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const queue = async (wears: readonly string[]) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      id,
      workspaceId,
      harness: 'dev',
      state: 'queued',
      placement: [['sandbox']],
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

  const provisioned = async (runId: string) => {
    const body = await eventually(async () =>
      endpoint.bodies.find((each) => JSON.parse(each).data.runId === runId),
    );

    return JSON.parse(body ?? '{}').data.runner as {
      token: string;
      egress: { url: string; credential: string; traffic: string } | null;
    };
  };

  const claimedBy = async (token: string) => {
    await http()
      .post('/api/runners/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ harnesses: HARNESSES })
      .expect(201);

    return http()
      .post('/api/runners/claim')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
  };

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `shared-egress-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
    endpoint = await listening();

    const egress = await created('egresses', {
      key: 'shared',
      url: 'https://egress.example.com',
    }).expect(201);
    egressId = egress.body.id;
    egressToken = egress.headers[EGRESS_TOKEN_HEADER.toLowerCase()] as string;

    await created('runner-pools', {
      key: 'sandboxes',
      labels: ['sandbox'],
      provision: { url: endpoint.url, secret: SECRET, egress: egressId },
    }).expect(201);
    await created('secrets', {
      name: 'LINEAR_API_KEY',
      bindings: [{ host: 'mcp.linear.app', prefix: 'Bearer ' }],
      valueWo: VALUE,
      valueWoVersion: 1,
    }).expect(201);
  });

  afterEach(async () => {
    endpoint.server.close();
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await db.delete(schema.run).where(eq(schema.run.workspaceId, workspaceId));
    await db
      .delete(schema.secret)
      .where(eq(schema.secret.workspaceId, workspaceId));
    await db
      .delete(schema.runGrants)
      .where(eq(schema.runGrants.workspaceId, workspaceId));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, workspaceId));
    await forgetRunnersOf(db, workspaceId);
    await unseat();
  });

  it('provisions a run that wears secrets, and hands the runner the egress and a proxy credential', async () => {
    const runId = await queue(['LINEAR_API_KEY']);

    const runner = await provisioned(runId);

    expect(egressToken).toEqual(expect.any(String));
    expect(runner.egress).toEqual({
      url: 'https://egress.example.com',
      credential: expect.any(String),
      traffic: 'all',
    });
    expect(runner.egress?.credential).not.toBe(runner.token);
  });

  it('redeems the run’s secrets for the shared egress only once the runner claims it', async () => {
    const runId = await queue(['LINEAR_API_KEY']);
    const runner = await provisioned(runId);
    const credential = runner.egress?.credential ?? '';
    const node = recipient();

    const admitted = await asEgress('admit', {
      proxyCredential: credential,
    }).expect(200);
    expect(admitted.body).toMatchObject({
      workspaceId,
      controlPlaneHost: expect.any(String),
      controlPlanePort: expect.any(Number),
    });

    await asEgress('redeem', {
      proxyCredential: credential,
      recipient: node.written,
    }).expect(409);

    expect((await claimedBy(runner.token)).body.run.id).toBe(runId);

    const redeemed = await asEgress('redeem', {
      proxyCredential: credential,
      recipient: node.written,
    }).expect(200);
    const [secret] = redeemed.body.secrets;

    expect(redeemed.body).toMatchObject({
      runId,
      bound: ['mcp.linear.app'],
    });
    expect(opened(secret.sealed, node, runId, 'LINEAR_API_KEY')).toBe(VALUE);

    const another = recipient();
    const again = await asEgress('redeem', {
      proxyCredential: credential,
      recipient: another.written,
    }).expect(200);
    expect(
      opened(again.body.secrets[0].sealed, another, runId, 'LINEAR_API_KEY'),
    ).toBe(VALUE);
  });

  it('never redeems with the proxy credential alone, nor through the egress beside a sandbox', async () => {
    const runId = await queue(['LINEAR_API_KEY']);
    const runner = await provisioned(runId);
    const credential = runner.egress?.credential ?? '';
    await claimedBy(runner.token);

    for (const token of [credential, runner.token, 'not-a-token']) {
      await asEgress(
        'redeem',
        { proxyCredential: credential, recipient: recipient().written },
        token,
      ).expect(401);
      await http()
        .post('/api/egress/redeem')
        .set('Authorization', `Bearer ${token}`)
        .send({ recipient: recipient().written })
        .expect(401);
    }
  });

  it('checks the active runs of standing runners, and records their connections for the trace', async () => {
    const runId = await queue(['LINEAR_API_KEY']);
    const runner = await provisioned(runId);
    const credential = runner.egress?.credential ?? '';
    await claimedBy(runner.token);

    const kept = await asEgress('active-runs', {
      proxyCredentials: [credential, 'unknown'],
    }).expect(200);
    expect(kept.body.active).toEqual([credential]);

    await asEgress('connections', {
      records: [
        {
          proxyCredential: credential,
          host: 'registry.npmjs.org',
          port: 443,
          bytesOut: 120,
          bytesIn: 4_000,
          ms: 35,
          outcome: 'tunnelled',
          at: new Date().toISOString(),
        },
        {
          proxyCredential: 'unknown',
          host: 'elsewhere.example.com',
          port: 443,
          bytesOut: 1,
          bytesIn: 1,
          ms: 1,
          outcome: 'tunnelled',
          at: new Date().toISOString(),
        },
      ],
    }).expect(204);

    const network = await http()
      .get(`/api/teams/${workspaceId}/runs/${runId}/network`)
      .set(TEST_USER_HEADER, owner)
      .expect(200);

    expect(network.body).toMatchObject({
      runId,
      egress: null,
      connections: [
        { host: 'registry.npmjs.org', port: 443, outcome: 'tunnelled' },
      ],
    });
  });

  it('records the last connections of a run for two minutes after its runner ended, and none after', async () => {
    const runId = await queue(['LINEAR_API_KEY']);
    const runner = await provisioned(runId);
    const credential = runner.egress?.credential ?? '';
    await claimedBy(runner.token);
    const connection = (host: string) => ({
      proxyCredential: credential,
      host,
      port: 443,
      bytesOut: 300,
      bytesIn: 2_000,
      ms: 20,
      outcome: 'forwarded',
      at: new Date().toISOString(),
    });

    await http()
      .post(`/api/runs/${runId}/completion`)
      .set('Authorization', `Bearer ${runner.token}`)
      .send({ exitCode: 0, failed: false })
      .expect(200);
    const [ended] = await eventually(async () => {
      const rows = await db
        .select()
        .from(schema.runner)
        .where(eq(schema.runner.workspaceId, workspaceId));

      return rows.every((each) => each.endedAt !== null) && rows;
    });

    expect(
      (
        await asEgress('active-runs', {
          proxyCredentials: [credential],
        }).expect(200)
      ).body.active,
    ).toEqual([]);
    await asEgress('connections', {
      records: [connection('mcp.linear.app')],
    }).expect(204);

    await db
      .update(schema.runner)
      .set({
        startedAt: new Date(Date.now() - 600_000),
        endedAt: new Date(Date.now() - 121_000),
      })
      .where(eq(schema.runner.id, ended?.id ?? ''));
    await asEgress('connections', {
      records: [connection('late.example.com')],
    }).expect(204);

    const network = await http()
      .get(`/api/teams/${workspaceId}/runs/${runId}/network`)
      .set(TEST_USER_HEADER, owner)
      .expect(200);

    expect(network.body.connections).toEqual([
      expect.objectContaining({
        host: 'mcp.linear.app',
        bytesOut: 300,
        outcome: 'forwarded',
      }),
    ]);
  });

  it('reads for the trace exactly the connections that went wrong, at most 500 for each run', async () => {
    const [busy, mixed] = [await queue([]), await queue([])];
    const at = (second: number) =>
      new Date(Date.UTC(2026, 9, 17, 9, 0, second));
    const row = (
      runId: string,
      second: number,
      part: Partial<typeof schema.runConnection.$inferInsert>,
    ) => ({
      runId,
      attempt: 1,
      host: 'example.com',
      port: 443,
      bytesOut: 0,
      bytesIn: 0,
      ms: 1,
      outcome: 'tunnelled',
      status: null,
      reason: null,
      at: at(second),
      ...part,
    });

    await db.insert(schema.runConnection).values([
      ...Array.from({ length: MAX_WENT_WRONG_FOR_A_RUN + 1 }, (_, each) =>
        row(busy, each % 60, {
          host: 'loop.example.com',
          outcome: 'blocked',
          reason: 'not-allowed',
        }),
      ),
      row(mixed, 1, { host: 'tunnelled.example.com' }),
      row(mixed, 2, {
        host: 'ok.example.com',
        outcome: 'forwarded',
        status: 200,
      }),
      row(mixed, 3, {
        host: 'gone.example.com',
        outcome: 'forwarded',
        status: 404,
      }),
      row(mixed, 4, {
        host: 'slow.example.com',
        outcome: 'forwarded',
        status: 429,
      }),
      row(mixed, 5, { host: 'cut.example.com', outcome: 'forwarded' }),
      row(mixed, 6, {
        host: 'refused.example.com',
        outcome: 'forwarded',
        status: 401,
      }),
      row(mixed, 7, {
        host: 'denied.example.com',
        outcome: 'forwarded',
        status: 403,
      }),
      row(mixed, 8, {
        host: 'broken.example.com',
        outcome: 'forwarded',
        status: 503,
      }),
      row(mixed, 9, {
        host: 'blocked.example.com',
        outcome: 'blocked',
        reason: 'not-bound',
      }),
      row(mixed, 10, {
        host: 'down.example.com',
        outcome: 'failed',
        reason: 'timed-out',
      }),
    ]);

    const read = await new DrizzleRunConnections(
      new DrizzleContext(db),
    ).wentWrongIn([busy, mixed]);
    const all = await new DrizzleRunConnections(new DrizzleContext(db)).of(
      mixed,
    );

    expect(read.filter((each) => each.runId === busy)).toHaveLength(
      MAX_WENT_WRONG_FOR_A_RUN,
    );
    expect(
      read
        .filter((each) => each.runId === mixed)
        .map((each) => each.connection.host),
    ).toEqual(
      all
        .filter((each) => each.connection.wentWrong)
        .map((each) => each.connection.host),
    );
    expect(
      read
        .filter((each) => each.runId === mixed)
        .map((each) => each.connection.trouble),
    ).toEqual(['refused', 'refused', 'server-error', 'blocked', 'failed']);
  });

  it('never lets the egress of another workspace serve this workspace’s runner', async () => {
    const runId = await queue(['LINEAR_API_KEY']);
    const runner = await provisioned(runId);
    const credential = runner.egress?.credential ?? '';
    await claimedBy(runner.token);
    const other = `shared-egress-${randomUUID().slice(0, 8)}`;
    const elsewhere = await seatTeam(db, other);

    try {
      const theirs = await http()
        .post(`/api/resources/workspaces/${other}/egresses`)
        .set(TEST_USER_HEADER, elsewhere.owner)
        .set('Idempotency-Key', randomUUID())
        .send({ key: 'shared', url: 'https://egress.example.com' })
        .expect(201);
      const theirToken = theirs.headers[
        EGRESS_TOKEN_HEADER.toLowerCase()
      ] as string;

      for (const path of ['admit', 'redeem']) {
        await asEgress(
          path,
          { proxyCredential: credential, recipient: recipient().written },
          theirToken,
        ).expect(401);
      }
      await created('runner-pools', {
        key: 'borrowed',
        provision: {
          url: endpoint.url,
          secret: SECRET,
          egress: theirs.body.id,
        },
      }).expect(422);
      await created('runner-pools', {
        key: 'unknown',
        provision: { url: endpoint.url, secret: SECRET, egress: 'no-such' },
      }).expect(422);
    } finally {
      await db
        .delete(schema.idempotentCreate)
        .where(
          inArray(schema.idempotentCreate.scope, [`person:${elsewhere.owner}`]),
        );
      await db
        .delete(schema.configurationChange)
        .where(eq(schema.configurationChange.workspaceId, other));
      await forgetRunnersOf(db, other);
      await elsewhere.unseat();
    }
  });

  it('refuses the old egress token once the token is rotated', async () => {
    const egress = await http()
      .get(`/api/resources/egresses/${egressId}`)
      .set(TEST_USER_HEADER, owner)
      .expect(200);
    const rotated = `rotated${randomUUID().replaceAll('-', '')}`;

    await http()
      .put(`/api/resources/egresses/${egressId}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${egress.body.version}"`)
      .send({
        key: 'shared',
        url: 'https://egress.example.com',
        token: rotated,
        tokenVersion: 2,
      })
      .expect(200);

    await asEgress('active-runs', { proxyCredentials: [] }).expect(401);
    await asEgress('active-runs', { proxyCredentials: [] }, rotated).expect(
      200,
    );
  });

  it('tells the runner to send only bound traffic through egress when the pool says so', async () => {
    const pool = await http()
      .get(
        `/api/resources/workspaces/${workspaceId}/runner-pools/import?address=sandboxes`,
      )
      .set(TEST_USER_HEADER, owner)
      .expect(200);
    await http()
      .put(`/api/resources/runner-pools/${pool.body.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${pool.body.version}"`)
      .send({
        key: 'sandboxes',
        labels: ['sandbox'],
        provision: {
          url: endpoint.url,
          egress: egressId,
          egressTraffic: 'bound',
        },
      })
      .expect(200);
    const runId = await queue(['LINEAR_API_KEY']);

    expect((await provisioned(runId)).egress?.traffic).toBe('bound');
  });

  it('refuses to delete an egress while a pool names it', async () => {
    const egress = await http()
      .get(`/api/resources/egresses/${egressId}`)
      .set(TEST_USER_HEADER, owner)
      .expect(200);

    await http()
      .delete(`/api/resources/egresses/${egressId}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${egress.body.version}"`)
      .expect(409);
  });
});
