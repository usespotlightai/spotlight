import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidSigningSecretError } from '@shared-kernel/domain/exceptions/invalid-signing-secret.error';
import { isSecret } from '@shared-kernel/domain/value-objects/secret';
import {
  SIGNING_SECRET_RULE,
  SigningSecret,
} from '@shared-kernel/domain/value-objects/signing-secret.vo';
import { describe, expect, it } from 'vitest';

const secretOf = (bytes: number) =>
  `whsec_${Buffer.alloc(bytes, 7).toString('base64')}`;

describe('SigningSecret', () => {
  it.each([24, 32, 64])('takes whsec_ and %i random bytes', (bytes) => {
    expect(SigningSecret.of(secretOf(bytes)).revealed()).toBe(secretOf(bytes));
  });

  it.each([
    ['no prefix', Buffer.alloc(32, 7).toString('base64')],
    ['another prefix', `whsek_${Buffer.alloc(32, 7).toString('base64')}`],
    ['too few bytes', secretOf(23)],
    ['too many bytes', secretOf(65)],
    [
      'characters outside base64',
      'whsec_not-base64-but-long-enough-to-count!!',
    ],
    ['nothing after the prefix', 'whsec_'],
  ])('refuses %s', (_, raw) => {
    expect(() => SigningSecret.of(raw)).toThrow(
      new InvalidSigningSecretError(SIGNING_SECRET_RULE),
    );
    expect(SigningSecret.isWellFormed(raw)).toBe(false);
  });

  it('says a stored secret in another shape is an inconsistent state', () => {
    expect(() => SigningSecret.rehydrate('whsec_')).toThrow(
      InconsistentStateError,
    );
    expect(SigningSecret.rehydrate(secretOf(32)).revealed()).toBe(secretOf(32));
  });

  it('gives the bytes after the prefix as the key', () => {
    expect(SigningSecret.of(secretOf(32)).key).toEqual(Buffer.alloc(32, 7));
  });

  it('never shows the secret when it is printed or serialized', () => {
    const secret = SigningSecret.of(secretOf(32));

    expect(isSecret(secret)).toBe(true);
    expect(String(secret)).toBe('[secret]');
    expect(JSON.stringify({ secret })).toBe('{"secret":"[secret]"}');
  });

  it('equals a secret of the same value', () => {
    expect(
      SigningSecret.of(secretOf(32)).equals(SigningSecret.of(secretOf(32))),
    ).toBe(true);
    expect(
      SigningSecret.of(secretOf(32)).equals(SigningSecret.of(secretOf(33))),
    ).toBe(false);
  });
});
