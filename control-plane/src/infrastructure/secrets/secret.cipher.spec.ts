import { randomBytes } from 'node:crypto';
import { SecretCipher } from '@infrastructure/secrets/secret.cipher';
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

  // Two rows holding one secret should not look alike in the database.
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

  // A stolen database is rows nobody can read, which is the whole point.
  it('will not open what another key sealed', () => {
    const sealed = new SecretCipher(OTHER).seal('whsec_abc123');

    expect(() => new SecretCipher(KEY).open(sealed)).toThrow();
  });

  // GCM, so a row edited in the database fails rather than opening as
  // something else.
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

  it('tells one sealed secret from another without opening either', () => {
    const cipher = new SecretCipher(KEY);
    const sealed = cipher.seal('same');

    expect(SecretCipher.same(sealed, sealed)).toBe(true);
    expect(SecretCipher.same(sealed, cipher.seal('other'))).toBe(false);
  });
});
