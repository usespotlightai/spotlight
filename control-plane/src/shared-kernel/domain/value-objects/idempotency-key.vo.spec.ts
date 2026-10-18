import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { describe, expect, it } from 'vitest';

describe('IdempotencyKey', () => {
  it('is any run of visible characters a client picks', () => {
    expect(IdempotencyKey.of('create-linear:7f3c').value).toBe(
      'create-linear:7f3c',
    );
  });

  it('rejects one that is empty, too long, or has spaces', () => {
    for (const raw of ['', 'a'.repeat(256), 'two words']) {
      expect(() => IdempotencyKey.of(raw)).toThrow(InvalidIdentifierError);
    }
  });
});
