import { randomBytes } from 'node:crypto';
import {
  SecretCipher,
  UnopenedSecretError,
} from '@platform/secrets/secret.cipher';
import { describe, expect, it } from 'vitest';

const KEY = randomBytes(32).toString('base64');
const OTHER = randomBytes(32).toString('base64');

describe('SecretCipher', () => {
  it('opens what it sealed', () => {
    const cipher = new SecretCipher(KEY);

    expect(cipher.open(cipher.seal('whsec_abc123'))).toBe('whsec_abc123');
  });

  it('seals anything a host would call a secret', () => {
    const cipher = new SecretCipher(KEY);

    for (const secret of ['', 'a'.repeat(4096), 'ünïcødé ✓', '{"k":"v"}']) {
      expect(cipher.open(cipher.seal(secret))).toBe(secret);
    }
  });

  it('seals the same secret differently every time', () => {
    const cipher = new SecretCipher(KEY);

    expect(cipher.seal('same')).not.toBe(cipher.seal('same'));
  });

  it('refuses a key that is not thirty-two bytes', () => {
    expect(() => new SecretCipher('short')).toThrow(/32 bytes/);
    expect(() => new SecretCipher(randomBytes(16).toString('base64'))).toThrow(
      /32 bytes/,
    );
  });

  it('will not open what another key sealed', () => {
    const sealed = new SecretCipher(OTHER).seal('whsec_abc123');

    expect(() => new SecretCipher(KEY).open(sealed)).toThrow();
  });

  it('will not open a secret that has been tampered with', () => {
    const cipher = new SecretCipher(KEY);
    const [version, iv, tag, sealed] = cipher.seal('whsec_abc123').split('.');
    const flipped = Buffer.from(sealed as string, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;

    expect(() =>
      cipher.open([version, iv, tag, flipped.toString('base64')].join('.')),
    ).toThrow();
  });

  it('will not open an envelope it did not write', () => {
    const cipher = new SecretCipher(KEY);

    expect(() => cipher.open('whsec_abc123')).toThrow(/not sealed/);
    expect(() => cipher.open('v2.a.b.c')).toThrow(/not sealed/);
    expect(() => cipher.open('v1..')).toThrow(/not sealed/);
  });

  it('will not open what another key sealed', () => {
    const sealed = new SecretCipher(KEY).seal('whsec_abc123');
    const other = new SecretCipher(Buffer.alloc(32, 9).toString('base64'));

    expect(() => other.open(sealed)).toThrow(UnopenedSecretError);
  });
});
