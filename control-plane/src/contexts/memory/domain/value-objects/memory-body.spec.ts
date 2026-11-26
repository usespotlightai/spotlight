import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { describe, expect, it } from 'vitest';

describe('MemoryBody', () => {
  it('contains what is remembered, trimmed, compared by value', () => {
    expect(MemoryBody.of('  Retry twice.  ').value).toBe('Retry twice.');
    expect(
      MemoryBody.of('Retry twice.').equals(MemoryBody.of(' Retry twice.')),
    ).toBe(true);
  });

  it('rejects saying nothing, or too much', () => {
    expect(() => MemoryBody.of('   ')).toThrow(InvalidMemoryError);
    expect(() => MemoryBody.of('x'.repeat(1_001))).toThrow(InvalidMemoryError);
  });

  it('is as similar to another as the words they share', () => {
    const known = MemoryBody.of(
      'The sandbox has no make, so npm ci fails compiling better-sqlite3. Run npm ci --ignore-scripts.',
    );

    expect(
      known.similarity(
        MemoryBody.of(
          "In the sandbox, 'npm ci' fails compiling better-sqlite3 because make is missing; use npm ci --ignore-scripts.",
        ),
      ),
    ).toBeGreaterThan(0.7);
    expect(
      known.similarity(MemoryBody.of('Name branches after the ticket.')),
    ).toBe(0);
    expect(known.similarity(known)).toBe(1);
  });
});
