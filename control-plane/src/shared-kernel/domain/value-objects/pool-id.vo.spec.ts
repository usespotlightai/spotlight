import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { describe, expect, it } from 'vitest';

describe('PoolId', () => {
  it('rejects a pool id that names no pool', () => {
    expect(() => PoolId.of('  ')).toThrow(InvalidIdentifierError);
  });

  it('is the same pool by value', () => {
    expect(PoolId.of('burst').equals(PoolId.of('burst'))).toBe(true);
    expect(PoolId.of('burst').equals(PoolId.of('steady'))).toBe(false);
  });
});
