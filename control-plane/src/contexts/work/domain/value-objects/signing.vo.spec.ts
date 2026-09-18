import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { Signing } from '@work/domain/value-objects/signing.vo';
import { describe, expect, it } from 'vitest';

const SECRET = SecretName.of('LINEAR_WEBHOOK_SECRET');

const signing = (over: Record<string, unknown> = {}) =>
  Signing.of({
    scheme: 'hmac-sha256',
    header: 'Linear-Signature',
    secret: SECRET,
    ...over,
  });

describe('Signing', () => {
  it('holds what the signature should be, and what names the secret', () => {
    expect(signing().scheme).toBe('hmac-sha256');
    expect(signing().secret).toEqual(SECRET);
  });

  it('keeps the header in one case, so either side may write it in any', () => {
    expect(signing().header).toBe('linear-signature');
    expect(signing({ header: 'X-Hub-Signature-256' }).header).toBe(
      'x-hub-signature-256',
    );
  });

  it('writes the digest as hex unless the host asks otherwise', () => {
    expect(signing().encoding).toBe('hex');
    expect(signing({ encoding: 'base64' }).encoding).toBe('base64');
  });

  it('carries whatever the host writes in front of the digest', () => {
    expect(signing().prefix).toBe('');
    expect(signing({ prefix: 'sha256=' }).prefix).toBe('sha256=');
  });

  it('refuses one that names no header to read', () => {
    expect(() => signing({ header: '   ' })).toThrow(InvalidIdentifierError);
  });
});
