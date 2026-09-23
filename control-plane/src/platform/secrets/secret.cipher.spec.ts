import { randomBytes } from 'node:crypto';
import {
  SecretCipher,
  UndecryptableSecretError,
} from '@platform/secrets/secret.cipher';
import { describe, expect, it } from 'vitest';

const KEY = randomBytes(32).toString('base64');
const OTHER = randomBytes(32).toString('base64');

describe('SecretCipher', () => {
  it('decrypts what it encrypted', () => {
    const cipher = new SecretCipher(KEY);

    expect(cipher.decrypt(cipher.encrypt('whsec_abc123'))).toBe('whsec_abc123');
  });

  it('encrypts anything a host would call a secret', () => {
    const cipher = new SecretCipher(KEY);

    for (const secret of ['', 'a'.repeat(4096), 'ünïcødé ✓', '{"k":"v"}']) {
      expect(cipher.decrypt(cipher.encrypt(secret))).toBe(secret);
    }
  });

  it('encrypts the same secret differently every time', () => {
    const cipher = new SecretCipher(KEY);

    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('refuses a key that is not thirty-two bytes', () => {
    expect(() => new SecretCipher('short')).toThrow(/32 bytes/);
    expect(() => new SecretCipher(randomBytes(16).toString('base64'))).toThrow(
      /32 bytes/,
    );
  });

  it('will not decrypt what another key encrypted', () => {
    const encrypted = new SecretCipher(OTHER).encrypt('whsec_abc123');

    expect(() => new SecretCipher(KEY).decrypt(encrypted)).toThrow();
  });

  it('will not decrypt a secret that has been tampered with', () => {
    const cipher = new SecretCipher(KEY);
    const [version, iv, tag, encrypted] = cipher
      .encrypt('whsec_abc123')
      .split('.');
    const flipped = Buffer.from(encrypted as string, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;

    expect(() =>
      cipher.decrypt([version, iv, tag, flipped.toString('base64')].join('.')),
    ).toThrow();
  });

  it('will not decrypt an envelope it did not write', () => {
    const cipher = new SecretCipher(KEY);

    expect(() => cipher.decrypt('whsec_abc123')).toThrow(/not encrypted/);
    expect(() => cipher.decrypt('v2.a.b.c')).toThrow(/not encrypted/);
    expect(() => cipher.decrypt('v1..')).toThrow(/not encrypted/);
  });

  it('will not decrypt what another key encrypted', () => {
    const encrypted = new SecretCipher(KEY).encrypt('whsec_abc123');
    const other = new SecretCipher(Buffer.alloc(32, 9).toString('base64'));

    expect(() => other.decrypt(encrypted)).toThrow(UndecryptableSecretError);
  });
});
