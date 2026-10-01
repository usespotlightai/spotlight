import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T10:00:00.000Z');

describe('MemoryRetirement', () => {
  it('is flagged wrong when a person retires it, saying why', () => {
    const retired = MemoryRetirement.retired({
      by: UserId.of('user_ada'),
      reason: 'We moved off that queue',
      at: AT,
    });

    expect(retired.flaggedWrong).toBe(true);
    expect(retired.superseded).toBe(false);
  });

  it('is not flagged wrong when a newer memory takes its place', () => {
    const superseded = MemoryRetirement.superseded(MemoryId.of('mem_2'), AT);

    expect(superseded.flaggedWrong).toBe(false);
    expect(superseded.superseded).toBe(true);
  });
});
