import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { describe, expect, it } from 'vitest';

describe('MemoryBody', () => {
  it('holds what is remembered, trimmed, compared by value', () => {
    expect(MemoryBody.of('  Retry twice.  ').value).toBe('Retry twice.');
    expect(
      MemoryBody.of('Retry twice.').equals(MemoryBody.of(' Retry twice.')),
    ).toBe(true);
  });

  it('refuses saying nothing, or too much', () => {
    expect(() => MemoryBody.of('   ')).toThrow(InvalidMemoryError);
    expect(() => MemoryBody.of('x'.repeat(1_001))).toThrow(InvalidMemoryError);
  });
});
