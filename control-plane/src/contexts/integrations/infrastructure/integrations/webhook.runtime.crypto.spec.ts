import { generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import {
  compileIntegration,
  type ReadableIntegration,
} from '@integrations/infrastructure/integrations/integration.compile';
import type { JwksResolver } from '@integrations/infrastructure/integrations/jwks';
import { WebhookRuntime } from '@integrations/infrastructure/integrations/webhook.runtime';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = 1_700_000_000;

const compiled = (text: string): ReadableIntegration => {
  const read = compileIntegration(parseYaml(text));
  if (!read.ok) {
    throw new Error(read.problems.map((each) => each.reason).join(', '));
  }
  return read.readable;
};

const EVENT = `
  events:
    - when: '\${{ true }}'
      raise:
        happening: x.thing
        label: A thing
        told: A thing happened.
        marks:
          - kind: x.thing
            value: '\${{ "one" }}'
`;

const raw = (body: unknown) => Buffer.from(JSON.stringify(body));

describe('verifying an ed25519 signature', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const hex = der.subarray(der.length - 32).toString('hex');

  const DISCORD = `
integration: x
webhook:
  verify:
    asymmetric:
      algorithm: ed25519
      key: ${hex}
      header: x-signature-ed25519
      signed: '\${{ headers["x-signature-timestamp"] + raw }}'
${EVENT}`;

  const runtime = () =>
    new WebhookRuntime(
      compiled(DISCORD),
      WORKSPACE,
      new Map(),
      () => NOW * 1000,
    );

  const signed = (body: unknown, ts = '170') => {
    const message = Buffer.concat([Buffer.from(ts), raw(body)]);
    return {
      headers: {
        'x-signature-ed25519': sign(null, message, privateKey).toString('hex'),
        'x-signature-timestamp': ts,
      },
      body,
      raw: raw(body),
    };
  };

  it('takes one the host really signed', async () => {
    expect(await runtime().verifies(signed({ type: 1 }))).toBe(true);
  });

  it('refuses one signed by another key', async () => {
    const other = generateKeyPairSync('ed25519').privateKey;
    const message = Buffer.concat([Buffer.from('170'), raw({ type: 1 })]);

    expect(
      await runtime().verifies({
        headers: {
          'x-signature-ed25519': sign(null, message, other).toString('hex'),
          'x-signature-timestamp': '170',
        },
        body: { type: 1 },
        raw: raw({ type: 1 }),
      }),
    ).toBe(false);
  });
});

describe('verifying an rsa-sha256 signature', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const RSA = `
integration: x
webhook:
  verify:
    asymmetric:
      algorithm: rsa-sha256
      encoding: base64
      header: x-signature
      key: |
${pem
  .trimEnd()
  .split('\n')
  .map((line) => `        ${line}`)
  .join('\n')}
${EVENT}`;

  const runtime = () =>
    new WebhookRuntime(compiled(RSA), WORKSPACE, new Map(), () => NOW * 1000);

  it('takes one the host really signed over the raw body', async () => {
    const body = { hello: 'world' };
    const signature = sign('sha256', raw(body), privateKey).toString('base64');

    expect(
      await runtime().verifies({
        headers: { 'x-signature': signature },
        body,
        raw: raw(body),
      }),
    ).toBe(true);
  });
});

describe('verifying a JWT against a JWKS', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const jwks: JwksResolver = {
    keys: async () => new Map<string, KeyObject>([['k1', publicKey]]),
  };

  const JWT = `
integration: x
webhook:
  verify:
    jwt:
      jwks: https://issuer.example/jwks.json
      audience: my-app
      issuer: https://issuer.example
      header: authorization
${EVENT}`;

  const runtime = () =>
    new WebhookRuntime(
      compiled(JWT),
      WORKSPACE,
      new Map(),
      () => NOW * 1000,
      jwks,
    );

  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  const token = (payload: Record<string, unknown>) => {
    const head = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
    const claims = b64(payload);
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(`${head}.${claims}`),
      privateKey,
    ).toString('base64url');

    return `${head}.${claims}.${signature}`;
  };

  const delivered = (payload: Record<string, unknown>) => ({
    headers: { authorization: `Bearer ${token(payload)}` },
    body: {},
    raw: Buffer.from('{}'),
  });

  const claims = {
    aud: 'my-app',
    iss: 'https://issuer.example',
    exp: NOW + 60,
  };

  it('takes a well-signed, unexpired token with the right audience', async () => {
    expect(await runtime().verifies(delivered(claims))).toBe(true);
  });

  it('refuses an expired one', async () => {
    expect(
      await runtime().verifies(delivered({ ...claims, exp: NOW - 1 })),
    ).toBe(false);
  });

  it('refuses one for another audience', async () => {
    expect(
      await runtime().verifies(delivered({ ...claims, aud: 'someone-else' })),
    ).toBe(false);
  });

  it('refuses one from another issuer', async () => {
    expect(
      await runtime().verifies(delivered({ ...claims, iss: 'https://evil' })),
    ).toBe(false);
  });

  it('refuses a token tampered after signing', async () => {
    const good = token(claims);
    const tampered = `${good.slice(0, -4)}aaaa`;

    expect(
      await runtime().verifies({
        headers: { authorization: `Bearer ${tampered}` },
        body: {},
        raw: Buffer.from('{}'),
      }),
    ).toBe(false);
  });
});
