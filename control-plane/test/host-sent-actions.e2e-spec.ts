import { randomUUID } from 'node:crypto';
import {
  INTEGRATION_RUNTIME,
  type IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  SECRET_INJECTION,
  type SecretInjectionPort,
} from '@secrets/application/ports/secret-injection.port';
import { eq, inArray, sql } from 'drizzle-orm';
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
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { opened, recipient } from './support/sealing';
import { seatTeam } from './support/team';

const HOST = 'host-actions-e2e-1';

const OTHER_HOST = 'host-actions-e2e-2';

const VALUE = 'xoxb-host-actions-e2e';

const TOKEN = `${'h'.repeat(8)}${randomUUID().replaceAll('-', '')}`;

const AUDIT = `integration: audit
actions:
  record:
    from: network
    request:
      method: POST
      url: https://audit.example.com/records
      auth:
        secrets: [secret.AUDIT_TOKEN]
      body:
        text: \${{ inputs.text }}
      capture:
        id: \${{ response.record.id }}
tools:
  record:
    action: record
    description: Record what the agent did.
    inputs:
      text:
        required: true
    output: \${{ capture.id }}
`;

interface ClaimedCall {
  readonly id: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly secretsToken?: string;
}

describe('an integration action sent from a host of the workspace (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const heartbeat = (host: string) =>
    http()
      .put(`/api/hosts/${host}`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        bootId: 'boot_1',
        name: host,
        release: '0.1.0',
        containerRuntime: 'docker',
        capacity: 1,
        running: [],
        images: [
          {
            image: 'ghcr.io/acme/runner:main',
            isDefault: true,
            harnesses: [{ id: 'dev', models: [] }],
          },
        ],
      })
      .expect(200);

  const sent = async (text: string) => {
    const runtime = app.get<IntegrationRuntimePort>(INTEGRATION_RUNTIME);
    const tool = await runtime.tool([defined(AUDIT)], 'audit.record', {
      taskId: 'task_1',
      workspaceId,
      teamId: 'team_1',
      line: 'delivery',
      station: 'Implementation',
      stationKey: 'implementation',
      marks: {},
      waiting: null,
    });

    return tool?.call(
      { text },
      {
        workspace: async () => workspaceId,
        connection: null,
        credentials: new SpotlightCredentials(
          app.get<SecretInjectionPort>(SECRET_INJECTION),
          async () => workspaceId,
        ),
      },
    );
  };

  const claimed = async (): Promise<ClaimedCall> => {
    for (;;) {
      const answer = await http()
        .post('/api/hosts/calls/claim')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ host: HOST });

      if (answer.status === 200) {
        return answer.body as ClaimedCall;
      }

      expect(answer.status).toBe(204);
    }
  };

  const redeem = (id: string, body: object) =>
    http().post(`/api/hosts/calls/${id}/secrets`).send(body);

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `actions-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;

    await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'hosts', labels: ['linux'], token: TOKEN })
      .expect(201);
    await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/secrets`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'AUDIT_TOKEN',
        bindings: [{ host: 'audit.example.com', prefix: 'Bearer ' }],
        valueWo: VALUE,
        valueWoVersion: 1,
      })
      .expect(201);
    await heartbeat(HOST);
    await heartbeat(OTHER_HOST);
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await db
      .delete(schema.networkCall)
      .where(eq(schema.networkCall.workspaceId, workspaceId));
    await db
      .delete(schema.secret)
      .where(eq(schema.secret.workspaceId, workspaceId));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, workspaceId));
    await deleteRunnersOf(db, workspaceId);
    await unseat();
  });

  it('hands a host stand-ins, seals the values once to its egress for the call alone, and reads the answer', async () => {
    const output = sent('deployed');
    const call = await claimed();

    expect(call.url).toBe('https://audit.example.com/records');
    expect(call.headers.authorization).toBe(
      'Bearer spotlight-egress:AUDIT_TOKEN',
    );
    expect(Buffer.from(call.body, 'base64').toString()).toBe(
      '{"text":"deployed"}',
    );
    expect(call.secretsToken).toEqual(expect.any(String));
    expect(JSON.stringify(call)).not.toContain(VALUE);

    const [stored] = await db
      .select()
      .from(schema.networkCall)
      .where(eq(schema.networkCall.id, call.id));
    expect(stored?.secrets).toEqual(['AUDIT_TOKEN']);
    expect(stored?.secretsTokenHash).not.toBe(call.secretsToken);
    expect(JSON.stringify(stored)).not.toContain(VALUE);

    await redeem(call.id, {
      host: HOST,
      token: 'not-the-token',
      recipient: recipient().written,
    }).expect(401);
    await redeem(call.id, {
      host: OTHER_HOST,
      token: call.secretsToken,
      recipient: recipient().written,
    }).expect(409);
    await redeem('no-such-call', {
      host: HOST,
      token: call.secretsToken,
      recipient: recipient().written,
    }).expect(401);

    const to = recipient();
    const fetched = await redeem(call.id, {
      host: HOST,
      token: call.secretsToken,
      recipient: to.written,
    }).expect(200);

    expect(fetched.body).toMatchObject({
      runId: call.id,
      extraAllowedHosts: [],
      bound: ['audit.example.com'],
      denied: [],
      spotlightApi: null,
    });
    const [audit] = fetched.body.secrets;
    expect(audit).toMatchObject({
      secret: 'AUDIT_TOKEN',
      host: 'audit.example.com',
      location: 'header',
      name: 'authorization',
      prefix: 'Bearer ',
      externalRef: null,
    });
    expect(JSON.stringify(fetched.body)).not.toContain(VALUE);
    expect(opened(audit.sealed, to, call.id, 'AUDIT_TOKEN')).toBe(VALUE);
    expect(() =>
      opened(audit.sealed, to, 'another-call', 'AUDIT_TOKEN'),
    ).toThrow();

    await redeem(call.id, {
      host: HOST,
      token: call.secretsToken,
      recipient: recipient().written,
    }).expect(409);

    await http()
      .post(`/api/hosts/calls/${call.id}/response`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        host: HOST,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{"record":{"id":"rec_42"}}').toString('base64'),
        ms: 31,
      })
      .expect(204);

    await expect(output).resolves.toBe('rec_42');
  });

  it('redeems the secrets for one of two egresses that ask at once', async () => {
    const output = sent('deployed');
    const call = await claimed();

    const answers = await Promise.all(
      [recipient(), recipient()].map((to) =>
        redeem(call.id, {
          host: HOST,
          token: call.secretsToken,
          recipient: to.written,
        }),
      ),
    );

    expect(answers.map((each) => each.status).sort()).toEqual([200, 409]);

    await http()
      .post(`/api/hosts/calls/${call.id}/response`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ host: HOST, status: 0, ms: 1, error: 'stopped' })
      .expect(204);
    await expect(output).rejects.toThrow('stopped');
  });

  it('redeems no secrets of a call that expired', async () => {
    const output = sent('deployed');
    const call = await claimed();
    await db
      .update(schema.networkCall)
      .set({
        expiresAt: sql`${schema.networkCall.queuedAt} + interval '1 millisecond'`,
      })
      .where(eq(schema.networkCall.id, call.id));

    await redeem(call.id, {
      host: HOST,
      token: call.secretsToken,
      recipient: recipient().written,
    }).expect(410);
    await expect(output).rejects.toThrow(
      'a host claimed it but didn’t answer within 30 seconds',
    );
  });
});
