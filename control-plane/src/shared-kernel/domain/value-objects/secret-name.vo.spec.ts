import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

describe('SecretName', () => {
  it('is named the way the environment names things', () => {
    expect(SecretName.of('LINEAR_WEBHOOK_SECRET').value).toBe(
      'LINEAR_WEBHOOK_SECRET',
    );
    expect(SecretName.of('  SENTRY_TOKEN  ').value).toBe('SENTRY_TOKEN');
  });

  it('is the same name as another spelled the same', () => {
    expect(SecretName.of('A_B').equals(SecretName.of('A_B'))).toBe(true);
    expect(SecretName.of('A_B').equals(SecretName.of('A_C'))).toBe(false);
  });

  it('rejects anything but capitals, digits and underscores', () => {
    for (const named of ['linear', 'Linear_Secret', 'A-B', 'A B', '', '1A']) {
      expect(() => SecretName.of(named)).toThrow(InvalidIdentifierError);
    }
  });

  it('is read from a reference to it, and from nothing else', () => {
    expect(SecretName.referencedBy('secret.LINEAR_API_KEY')?.value).toBe(
      'LINEAR_API_KEY',
    );
    for (const written of [
      'LINEAR_API_KEY',
      'secret.linear',
      'secrets.LINEAR_API_KEY',
      'secret.LINEAR_API_KEY trailing',
      'Bearer secret.LINEAR_API_KEY',
    ]) {
      expect(SecretName.referencedBy(written)).toBeNull();
    }
  });

  it('rejects one longer than anybody would type', () => {
    expect(() => SecretName.of('A'.repeat(65))).toThrow(InvalidIdentifierError);
  });
});
