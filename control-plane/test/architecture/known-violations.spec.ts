import { describe, expect, it } from 'vitest';
import { ratchetProblems } from './known-violations';

describe('ratchetProblems', () => {
  const found = [
    { key: 'a', at: 'one.ts:1' },
    { key: 'a', at: 'one.ts:9' },
  ];

  it('accepts violations that match the known count', () => {
    expect(ratchetProblems(found, { a: { count: 2 } })).toEqual([]);
  });

  it('reports a violation beyond the known count', () => {
    expect(ratchetProblems(found, { a: { count: 1 } })).toEqual([
      'new: a (2 found, 1 known) at one.ts:1, one.ts:9',
    ]);
  });

  it('reports a known entry that is fixed', () => {
    expect(ratchetProblems([], { a: { count: 1, finding: 'X-01' } })).toEqual([
      'fixed, lower or remove the known entry: a (0 found, 1 known)',
    ]);
  });
});
