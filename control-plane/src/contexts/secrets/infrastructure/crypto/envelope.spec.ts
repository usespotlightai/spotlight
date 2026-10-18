import { randomBytes } from 'node:crypto';
import {
  DecryptionFailedError,
  decrypt,
  encrypt,
} from '@secrets/infrastructure/crypto/envelope';
import { describe, expect, it } from 'vitest';

const KEY = randomBytes(32);
const PLAIN = Buffer.from('lin_api_1');
const AAD = 'spotlight:secret:v1\u0000ws_1\u0000LINEAR_API_KEY';

describe('the encrypted envelope', () => {
  it('decrypts to what was encrypted, with the same key and AAD', () => {
    expect(decrypt(KEY, encrypt(KEY, PLAIN, AAD), AAD).toString()).toBe(
      'lin_api_1',
    );
  });

  it('encrypts the same value differently every time, and never in the clear', () => {
    const one = encrypt(KEY, PLAIN, AAD);

    expect(one).not.toBe(encrypt(KEY, PLAIN, AAD));
    expect(one).not.toContain('lin_api_1');
    expect(Buffer.from(one.split('.')[3] ?? '', 'base64')).not.toEqual(PLAIN);
  });

  it('does not decrypt under another workspace or name', () => {
    const one = encrypt(KEY, PLAIN, AAD);

    expect(() =>
      decrypt(KEY, one, 'spotlight:secret:v1\u0000ws_2\u0000LINEAR_API_KEY'),
    ).toThrow(DecryptionFailedError);
    expect(() =>
      decrypt(KEY, one, 'spotlight:secret:v1\u0000ws_1\u0000SENTRY_TOKEN'),
    ).toThrow(DecryptionFailedError);
  });

  it('does not decrypt with another key', () => {
    expect(() =>
      decrypt(randomBytes(32), encrypt(KEY, PLAIN, AAD), AAD),
    ).toThrow(DecryptionFailedError);
  });

  it('does not decrypt after a change to it', () => {
    const [version, iv, tag, body] = encrypt(KEY, PLAIN, AAD).split('.');
    const flipped = Buffer.from(body ?? '', 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;

    expect(() =>
      decrypt(
        KEY,
        [version, iv, tag, flipped.toString('base64')].join('.'),
        AAD,
      ),
    ).toThrow(DecryptionFailedError);
  });

  it('does not decrypt what it did not encrypt', () => {
    for (const envelope of ['lin_api_1', 'v2.a.b.c', 'v1..', 'v1.a.b.c.d']) {
      expect(() => decrypt(KEY, envelope, AAD), envelope).toThrow(
        DecryptionFailedError,
      );
    }
  });
});
