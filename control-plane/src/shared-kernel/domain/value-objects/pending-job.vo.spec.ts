import {
  MAX_JOB_ATTEMPTS,
  MAX_WAIT_MS,
  PendingJob,
  WAIT_MS,
} from '@shared-kernel/domain/value-objects/pending-job.vo';
import { describe, expect, it } from 'vitest';

const noon = new Date('2026-11-21T12:00:00.000Z');
const later = (ms: number) => new Date(noon.getTime() + ms);

describe('PendingJob', () => {
  describe('waiting', () => {
    it('hands back the attempt its lease counted and looks again a while later', () => {
      const waiting = PendingJob.fresh().lease(noon).wait(noon);

      expect(waiting.attempts).toBe(0);
      expect(waiting.nextAttemptAt).toEqual(later(WAIT_MS));
      expect(waiting.waitingSince).toEqual(noon);
    });

    it('is due again once its wait is over', () => {
      const waiting = PendingJob.fresh().lease(noon).wait(noon);

      expect(waiting.isDue(later(WAIT_MS - 1))).toBe(false);
      expect(waiting.isDue(later(WAIT_MS))).toBe(true);
    });

    it('keeps the time it began to wait across its leases and waits', () => {
      const again = PendingJob.fresh()
        .lease(noon)
        .wait(noon)
        .lease(later(WAIT_MS))
        .wait(later(WAIT_MS));

      expect(again.waitingSince).toEqual(noon);
      expect(again.nextAttemptAt).toEqual(later(2 * WAIT_MS));
    });

    it('never runs out of attempts by waiting', () => {
      let job = PendingJob.rehydrate({
        attempts: MAX_JOB_ATTEMPTS - 1,
        nextAttemptAt: null,
        waitingSince: null,
      });

      for (let round = 0; round < MAX_JOB_ATTEMPTS * 2; round += 1) {
        job = job.lease(later(round * WAIT_MS)).wait(later(round * WAIT_MS));
      }

      expect(job.attempts).toBe(MAX_JOB_ATTEMPTS - 1);
      expect(job.exhausted).toBe(false);
    });

    it('is exhausted once it would wait longer than the longest wait', () => {
      const lastWait = MAX_WAIT_MS - WAIT_MS;
      const waiting = PendingJob.fresh().lease(noon).wait(noon);

      expect(
        waiting.lease(later(lastWait)).wait(later(lastWait)).exhausted,
      ).toBe(false);
      expect(
        waiting.lease(later(lastWait + 1)).wait(later(lastWait + 1)).exhausted,
      ).toBe(true);
    });

    it('never counts fewer than no attempts', () => {
      expect(PendingJob.fresh().wait(noon).attempts).toBe(0);
    });
  });

  describe('waking', () => {
    it('makes a waiting job due now', () => {
      const woken = PendingJob.fresh()
        .lease(noon)
        .wait(noon)
        .wake(later(5_000));

      expect(woken.isDue(later(5_000))).toBe(true);
      expect(woken.nextAttemptAt).toEqual(later(5_000));
      expect(woken.waitingSince).toEqual(noon);
      expect(woken.attempts).toBe(0);
    });

    it('leaves a leased job alone, though it has waited before', () => {
      const leased = PendingJob.fresh()
        .lease(noon)
        .wait(noon)
        .lease(later(WAIT_MS));

      expect(leased.isWaiting(later(WAIT_MS + 1_000))).toBe(false);
      expect(leased.wake(later(WAIT_MS + 1_000))).toBe(leased);
    });

    it('leaves a job that never waited alone', () => {
      const retried = PendingJob.fresh().lease(noon).scheduleRetry(noon);

      expect(retried.wake(later(1_000))).toBe(retried);
    });
  });

  it('stops waiting when it is retried', () => {
    const waiting = PendingJob.fresh().lease(noon).wait(noon);

    expect(waiting.lease(later(WAIT_MS)).scheduleRetry(noon).waitingSince).toBe(
      null,
    );
    expect(waiting.scheduleRetryAt(later(1)).waitingSince).toBe(null);
  });

  it('refuses a stored job with a negative number of attempts', () => {
    expect(() =>
      PendingJob.rehydrate({
        attempts: -1,
        nextAttemptAt: null,
        waitingSince: null,
      }),
    ).toThrow('has been attempted -1 times');
  });
});
