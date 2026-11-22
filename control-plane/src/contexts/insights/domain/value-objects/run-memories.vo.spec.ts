import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import {
  MemoryReference,
  RunMemories,
  USED,
} from '@insights/domain/value-objects/run-memories.vo';
import { describe, expect, it } from 'vitest';

const none = {
  briefed: [],
  cut: [],
  read: [],
  recalled: [],
  delivered: [],
};

describe('RunMemories', () => {
  it('keeps each memory once, in order, apart for each way the run came by it', () => {
    const memories = RunMemories.NONE.with('briefed', [
      MemoryReference.of('mem_2'),
      MemoryReference.of('mem_1'),
    ])
      .with('briefed', [
        MemoryReference.of('mem_1'),
        MemoryReference.of('mem_3'),
      ])
      .with('recalled', [MemoryReference.of('mem_2')])
      .with('read', [MemoryReference.of('mem_4')])
      .with('delivered', [MemoryReference.of('mem_5')]);

    expect(memories.briefed).toEqual(['mem_1', 'mem_2', 'mem_3']);
    expect(memories.recalled).toEqual(['mem_2']);
    expect(memories.read).toEqual(['mem_4']);
    expect(memories.delivered).toEqual(['mem_5']);
    expect(memories.used).toBe(true);
  });

  it('does not count a memory the cap cut as used', () => {
    const memories = RunMemories.NONE.with('cut', [
      MemoryReference.of('mem_1'),
    ]);

    expect(memories.cut).toEqual(['mem_1']);
    expect(memories.used).toBe(false);
  });

  it('stays the same when it already has every memory', () => {
    const memories = RunMemories.of({ ...none, briefed: ['mem_1'] });

    expect(memories.with('briefed', [MemoryReference.of('mem_1')])).toBe(
      memories,
    );
    expect(memories.with('recalled', [])).toBe(memories);
    expect(RunMemories.NONE.used).toBe(false);
  });

  it('rejects a memory with no name', () => {
    expect(() =>
      RunMemories.NONE.with('recalled', [MemoryReference.of(' ')]),
    ).toThrow(InvalidOutcomeError);
  });

  it('counts a cut memory as cut then read once the run reads, recalls or is given it', () => {
    const memories = RunMemories.of({
      ...none,
      cut: ['mem_1', 'mem_2', 'mem_3'],
      read: ['mem_1'],
      delivered: ['mem_3'],
    });

    expect(memories.cutThenRead).toEqual(['mem_1', 'mem_3']);
  });

  it('counts every way of using a memory except a cut as used', () => {
    expect(USED).toEqual(['briefed', 'read', 'recalled', 'delivered']);
  });
});
