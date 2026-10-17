import {
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  type KeyObject,
} from 'node:crypto';
import { InvalidRecipientError } from '@secrets/application/errors/invalid-recipient.error';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { X25519RunSealing } from '@secrets/infrastructure/sealing/run-sealing';
import { describe, expect, it } from 'vitest';

const recipient = () => {
  const pair = generateKeyPairSync('x25519');
  const { x } = pair.publicKey.export({ format: 'jwk' });

  return {
    privateKey: pair.privateKey,
    raw: Buffer.from(x ?? '', 'base64url'),
    written: Buffer.from(x ?? '', 'base64url').toString('base64'),
  };
};

const opened = (
  sealed: string,
  privateKey: KeyObject,
  recipientRaw: Buffer,
  aad: string,
): string => {
  const [version, ephemeral, iv, tag, encrypted] = sealed.split('.');
  expect(version).toBe('v1');

  const ephemeralRaw = Buffer.from(ephemeral ?? '', 'base64');
  const shared = diffieHellman({
    privateKey,
    publicKey: createPublicKey({
      key: { kty: 'OKP', crv: 'X25519', x: ephemeralRaw.toString('base64url') },
      format: 'jwk',
    }),
  });
  const key = Buffer.from(
    hkdfSync(
      'sha256',
      shared,
      Buffer.concat([ephemeralRaw, recipientRaw]),
      'spotlight:egress-seal:v1',
      32,
    ),
  );
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv ?? '', 'base64'),
  );
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag ?? '', 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted ?? '', 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const FOR = { runId: 'run_1', secretName: 'LINEAR_API_KEY' };

const sealedTo = (
  to: { written: string },
  value = 'lin_api_1',
  sealedFor = FOR,
) =>
  sealing.seal(
    SecretValue.of(value),
    sealing.recipientOf(to.written),
    sealedFor,
  );

const AAD = ['spotlight:egress:v1', 'run_1', 'LINEAR_API_KEY'].join('\u0000');

const sealing = new X25519RunSealing();

describe('X25519RunSealing', () => {
  it('seals a value only the run’s recipient opens', () => {
    const to = recipient();

    const sealed = sealedTo(to);

    expect(sealed).not.toContain('lin_api_1');
    expect(opened(sealed, to.privateKey, to.raw, AAD)).toBe('lin_api_1');
  });

  it('binds the value to its run and its name', () => {
    const to = recipient();
    const sealed = sealedTo(to);

    expect(() =>
      opened(
        sealed,
        to.privateKey,
        to.raw,
        ['spotlight:egress:v1', 'run_2', 'LINEAR_API_KEY'].join('\u0000'),
      ),
    ).toThrow();
  });

  it('seals afresh every time', () => {
    const to = recipient();
    const once = sealedTo(to);
    const again = sealedTo(to);

    expect(once).not.toBe(again);
  });

  it('rejects a recipient that is not a 32-byte key in base64', () => {
    for (const written of [
      '',
      'not-base64!',
      Buffer.alloc(31).toString('base64'),
      Buffer.alloc(32).toString('base64'),
    ]) {
      expect(() => sealing.recipientOf(written)).toThrow(InvalidRecipientError);
    }
  });
});
