import { replayChecksOf } from '@replays/domain/services/replay-checks';
import type { ChecksState } from '@replays/domain/value-objects/change-checks.vo';
import {
  type EntryReasonCode,
  reasonOf,
} from '@replays/domain/value-objects/entry-reason';
import { describe, expect, it } from 'vitest';

const entryOf = (
  state: ChecksState | null,
  reason: { code: EntryReasonCode; detail?: string } | null = null,
) => ({
  checks: state && { state, pending: false },
  reasons: reason ? [reasonOf(reason.code, reason.detail ?? null)] : [],
});

describe('replayChecksOf', () => {
  it('counts the runs whose checks passed or failed as checked', () => {
    expect(
      replayChecksOf([
        {
          entries: [
            entryOf('passed'),
            entryOf('failed', { code: 'check-failed' }),
          ],
        },
        { entries: [entryOf('checking'), entryOf(null)] },
      ]),
    ).toEqual({ ran: 2, skipped: [] });
  });

  it('counts each skip reason, the most frequent first', () => {
    expect(
      replayChecksOf([
        {
          entries: [
            entryOf('unchecked', { code: 'change-not-generated' }),
            entryOf('unchecked', {
              code: 'check-skipped',
              detail: 'checkout-failed',
            }),
            entryOf('unchecked', {
              code: 'check-skipped',
              detail: 'checkout-failed',
            }),
            entryOf('unchecked', { code: 'check-skipped', detail: 'unknown' }),
          ],
        },
      ]),
    ).toEqual({
      ran: 0,
      skipped: [
        { skip: 'checkout-failed', runs: 2 },
        { skip: 'not-generated', runs: 1 },
        { skip: 'skipped', runs: 1 },
      ],
    });
  });
});
