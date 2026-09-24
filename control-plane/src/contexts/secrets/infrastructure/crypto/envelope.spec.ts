import { randomBytes } from 'node:crypto';
import {
  opened,
  sealed,
  UnopenableEnvelopeError,
} from '@secrets/infrastructure/crypto/envelope';
import { describe, expect, it } from 'vitest';

const KEY = randomBytes(32);
const PLAIN = Buffer.from('lin_api_1');
const BOUND = 'spotlight:secret:v1\u0000ws_1\u0000LINEAR_API_KEY';

describe('the sealed envelope', () => {
  it('opens to what was sealed, with the same key and binding', () => {
    expect(opened(KEY, sealed(KEY, PLAIN, BOUND), BOUND).toString()).toBe(
      'lin_api_1',
    );
  });

  it('seals the same value differently every time, and never in the clear', () => {
    const one = sealed(KEY, PLAIN, BOUND);

    expect(one).not.toBe(sealed(KEY, PLAIN, BOUND));
    expect(one).not.toContain('lin_api_1');
    expect(Buffer.from(one.split('.')[3] ?? '', 'base64')).not.toEqual(PLAIN);
  });

  it('will not open under another workspace or name', () => {
    const one = sealed(KEY, PLAIN, BOUND);

    expect(() =>
      opened(KEY, one, 'spotlight:secret:v1\u0000ws_2\u0000LINEAR_API_KEY'),
    ).toThrow(UnopenableEnvelopeError);
    expect(() =>
      opened(KEY, one, 'spotlight:secret:v1\u0000ws_1\u0000SENTRY_TOKEN'),
    ).toThrow(UnopenableEnvelopeError);
  });

  it('will not open with another key', () => {
    expect(() =>
      opened(randomBytes(32), sealed(KEY, PLAIN, BOUND), BOUND),
    ).toThrow(UnopenableEnvelopeError);
  });

  it('will not open once tampered with', () => {
    const [version, iv, tag, body] = sealed(KEY, PLAIN, BOUND).split('.');
    const flipped = Buffer.from(body ?? '', 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;

    expect(() =>
      opened(
        KEY,
        [version, iv, tag, flipped.toString('base64')].join('.'),
        BOUND,
      ),
    ).toThrow(UnopenableEnvelopeError);
  });

  it('will not open what it did not seal', () => {
    for (const envelope of ['lin_api_1', 'v2.a.b.c', 'v1..', 'v1.a.b.c.d']) {
      expect(() => opened(KEY, envelope, BOUND), envelope).toThrow(
        UnopenableEnvelopeError,
      );
    }
  });
});
