import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import {
  MEMORY_DRAFTING_FAILURES,
  MemoryDraftingFailure,
} from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');

describe('MemoryDraftingFailure', () => {
  it('never allows more attempts than a draft can be leased for', () => {
    for (const retry of Object.values(MEMORY_DRAFTING_FAILURES)) {
      expect(retry.maxAttempts).toBeLessThanOrEqual(MAX_JOB_ATTEMPTS);
    }
  });

  it('allows a retry after a failed request, but never once the evidence is gone', () => {
    expect(
      MemoryDraftingFailure.of('request-failed', NOW).retry.allowsRetry,
    ).toBe(true);
    expect(MemoryDraftingFailure.of('no-evidence', NOW).retry.allowsRetry).toBe(
      false,
    );
  });

  it('rejects a failure nobody knows', () => {
    expect(() => MemoryDraftingFailure.of('melted', NOW)).toThrow(
      InvalidMemoryError,
    );
  });
});
