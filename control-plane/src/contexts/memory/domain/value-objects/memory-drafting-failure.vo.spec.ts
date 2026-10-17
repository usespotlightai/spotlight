import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import {
  MEMORY_DRAFTING_FAILURES,
  MemoryDraftingFailure,
} from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MAX_WORK_ATTEMPTS } from '@shared-kernel/domain/value-objects/owed-work.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');

describe('MemoryDraftingFailure', () => {
  it('never allows more attempts than a draft can be leased for', () => {
    for (const retry of Object.values(MEMORY_DRAFTING_FAILURES)) {
      expect(retry.max).toBeLessThanOrEqual(MAX_WORK_ATTEMPTS);
    }
  });

  it('tries again after a failed request, but never once the evidence is gone', () => {
    expect(MemoryDraftingFailure.of('request-failed', NOW).retry.retries).toBe(
      true,
    );
    expect(MemoryDraftingFailure.of('no-evidence', NOW).retry.retries).toBe(
      false,
    );
  });

  it('rejects a failure nobody knows', () => {
    expect(() => MemoryDraftingFailure.of('melted', NOW)).toThrow(
      InvalidMemoryError,
    );
  });
});
