import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { describe, expect, it } from 'vitest';

const M1 = { id: 'memory_1', handle: 'M-1' };
const M2 = { id: 'memory_2', handle: 'M-2' };

describe('BriefedMemories', () => {
  it('keeps what a run was told apart from what the cap omitted', () => {
    const memories = BriefedMemories.of({ briefed: [M1], omitted: [M2] });

    expect(memories.value).toEqual({ briefed: [M1], omitted: [M2] });
    expect(
      memories.equals(BriefedMemories.of({ briefed: [M1], omitted: [M2] })),
    ).toBe(true);
    expect(
      memories.equals(BriefedMemories.of({ briefed: [M1, M2], omitted: [] })),
    ).toBe(false);
  });

  it('never has a memory both told and omitted, or one it cannot name', () => {
    expect(() => BriefedMemories.of({ briefed: [M1], omitted: [M1] })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      BriefedMemories.of({
        briefed: [{ id: ' ', handle: 'M-3' }],
        omitted: [],
      }),
    ).toThrow(InconsistentStateError);
  });
});
