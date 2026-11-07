import { ReplayRunClaim } from '@replays/domain/aggregates/replay-run-claim.aggregate';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const FINGERPRINT = StationFingerprint.of('a'.repeat(64));

const ordered = () =>
  ReplayRunClaim.toQueue(RUN).ordered({
    fingerprint: FINGERPRINT,
    movesOnAfter: ['Ship', 'done'],
  });

describe('ReplayRunClaim', () => {
  it('records the trial it ordered only while it may still queue the run', () => {
    expect(ordered().trial?.movesOnAfter).toEqual(['ship', 'done']);
    expect(() =>
      ReplayRunClaim.toCancel(RUN).ordered({
        fingerprint: null,
        movesOnAfter: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('is cancelled from queued, and stays as it is once settled', () => {
    const cancelled = ordered().cancelled();

    expect(cancelled.mayQueue).toBe(false);
    expect(cancelled.trial?.fingerprint).toBe(FINGERPRINT);
    expect(cancelled.cancelled()).toBe(cancelled);
    expect(() => cancelled.unreplayable('cannot-start', 'no')).toThrow(
      InconsistentStateError,
    );
  });

  it('says a replay asked a person when it handed over and did not move on', () => {
    const claim = ordered();

    expect(claim.askedAPersonAfter(false, null)).toBe(false);
    expect(claim.askedAPersonAfter(true, 'SHIP')).toBe(false);
    expect(claim.askedAPersonAfter(true, 'review')).toBe(true);
    expect(claim.askedAPersonAfter(true, null)).toBe(true);
  });

  it('is unreplayable exactly when it says why', () => {
    expect(() =>
      ReplayRunClaim.rehydrate({
        runId: RUN,
        claimedAs: 'unreplayable',
        unreplayableReason: null,
        reason: null,
        trial: null,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
