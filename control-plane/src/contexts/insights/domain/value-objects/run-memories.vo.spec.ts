import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import { RunMemories } from '@insights/domain/value-objects/run-memories.vo';
import { describe, expect, it } from 'vitest';

describe('RunMemories', () => {
  it('keeps each memory once, in order, apart for briefed and recalled', () => {
    const memories = RunMemories.NONE.with('briefed', ['mem_2', 'mem_1'])
      .with('briefed', ['mem_1', 'mem_3'])
      .with('recalled', ['mem_2']);

    expect(memories.briefed).toEqual(['mem_1', 'mem_2', 'mem_3']);
    expect(memories.recalled).toEqual(['mem_2']);
    expect(memories.used).toBe(true);
  });

  it('stays the same when it already has every memory', () => {
    const memories = RunMemories.of({ briefed: ['mem_1'], recalled: [] });

    expect(memories.with('briefed', ['mem_1'])).toBe(memories);
    expect(memories.with('recalled', [])).toBe(memories);
    expect(RunMemories.NONE.used).toBe(false);
  });

  it('rejects a memory with no name', () => {
    expect(() => RunMemories.NONE.with('recalled', [' '])).toThrow(
      InvalidOutcomeError,
    );
  });
});
