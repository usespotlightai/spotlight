import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { InvalidHookFiringTransitionError } from '@integrations/domain/exceptions/invalid-hook-firing-transition.error';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const later = (ms: number) => new Date(NOW.getTime() + ms);

const MOVED = {
  kind: 'event' as const,
  key: 'task.moved:task_1:triage → build',
  saying: 'task.moved of Add a column (triage → build)',
};

const AUDIT = {
  kind: 'hook' as const,
  key: `hook:audit_id:${MOVED.key}`,
  saying: 'the hook audit',
};

const LOOP = HookFailure.of('loop', 'The hook audit was stopped: again');

const fired = (cause = CausalChain.none().followedBy(MOVED)) =>
  HookFiring.fire({
    id: 'firing_1',
    hookId: 'audit_id',
    workspaceId: 'workspace_1',
    teamId: 'team_1',
    taskId: 'task_1',
    runId: 'run_1',
    stationKey: 'implementation',
    on: 'task.moved',
    occurrence: 'moved_1',
    firedAt: NOW,
    event: { from: 'triage', to: 'build' },
    matched: true,
    cause,
    link: AUDIT,
  });

const stateOf = (firing: HookFiring) => ({
  id: firing.id,
  hookId: firing.hookId,
  workspaceId: firing.workspaceId,
  teamId: firing.teamId,
  taskId: firing.taskId,
  runId: firing.runId,
  stationKey: firing.stationKey,
  on: firing.on,
  occurrence: firing.occurrence,
  firedAt: firing.firedAt,
  event: firing.event,
  matched: firing.matched,
  cause: firing.cause,
  link: firing.link,
  steps: firing.steps,
  progress: firing.progress,
  attempts: firing.attempts,
  failure: firing.failure,
  version: firing.version,
});

const kept = (firing: HookFiring, version = 1) =>
  HookFiring.rehydrate({ ...stateOf(firing), version });

const working = (firing = fired()) => kept(firing).claimed(NOW);

const DONE_A = { name: 'a', status: 'done' as const, output: null };

describe('HookFiring', () => {
  it('waits to be worked from the moment it fired', () => {
    const firing = fired();

    expect(firing.progress).toEqual({ kind: 'pending', dueAt: NOW });
    expect(firing.attempts).toBe(0);
    expect(firing.isNew).toBe(true);
  });

  it('keeps its own frozen copy of the event it fired on', () => {
    const event = { from: 'triage', to: 'build', marks: ['db'] };
    const firing = HookFiring.fire({
      ...stateOf(fired()),
      event,
    });

    event.marks.push('api');

    expect(firing.event).toEqual({
      from: 'triage',
      to: 'build',
      marks: ['db'],
    });
    expect(Object.isFrozen(firing.event)).toBe(true);
    expect(Object.isFrozen(firing.event.marks)).toBe(true);
  });

  describe('being claimed', () => {
    it('is claimed once it is due', () => {
      expect(working().progress).toEqual({ kind: 'working', claimedAt: NOW });
    });

    it('is not claimed before it is due', () => {
      const waiting = kept(working().waitUntil(later(2_000)));

      expect(() => waiting.claimed(later(1_000))).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(waiting.claimed(later(2_000)).progress.kind).toBe('working');
    });

    it('is not claimed from a worker that still has the lease, only once its lease expires', () => {
      const leased = kept(working());

      expect(() => leased.claimed(later(10 * 60_000))).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(leased.claimed(later(10 * 60_000 + 1)).progress).toEqual({
        kind: 'working',
        claimedAt: later(10 * 60_000 + 1),
      });
    });

    it('is never claimed once finished', () => {
      const done = kept(working().worked(NOW));

      expect(() => done.claimed(later(60 * 60_000))).toThrow(
        InvalidHookFiringTransitionError,
      );
    });
  });

  describe('while a worker has the lease', () => {
    it('keeps the steps it has taken', () => {
      expect(working().recordStep([DONE_A]).steps).toEqual([DONE_A]);
    });

    it('is matched once, with what it learned about the event', () => {
      const unmatched = HookFiring.rehydrate({
        ...stateOf(fired()),
        matched: false,
        version: 1,
      }).claimed(NOW);
      const matched = unmatched.recordMatch({ changed: ['db/1.sql'] });

      expect(matched.matched).toBe(true);
      expect(matched.event).toEqual({ changed: ['db/1.sql'] });
      expect(() => matched.recordMatch({})).toThrow(
        InvalidHookFiringTransitionError,
      );
    });

    it('keeps its own frozen copy of the event it matched', () => {
      const learned = { changed: ['db/1.sql'] };
      const matched = HookFiring.rehydrate({
        ...stateOf(fired()),
        matched: false,
        version: 1,
      })
        .claimed(NOW)
        .recordMatch(learned);

      learned.changed.push('db/2.sql');

      expect(matched.event).toEqual({ changed: ['db/1.sql'] });
      expect(Object.isFrozen(matched.event.changed)).toBe(true);
    });

    it('waits on a host without spending an attempt', () => {
      const waiting = working().waitUntil(later(2_000));

      expect(waiting.progress).toEqual({
        kind: 'pending',
        dueAt: later(2_000),
      });
      expect(waiting.attempts).toBe(0);
    });

    it('is worked, spending an attempt', () => {
      const done = working().worked(later(1_000));

      expect(done.progress).toEqual({ kind: 'done', at: later(1_000) });
      expect(done.attempts).toBe(1);
      expect(done.finished).toBe(true);
    });

    it('rejects every change unless a worker has the lease', () => {
      const pending = kept(fired());

      expect(() => pending.recordStep([DONE_A])).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(() => pending.waitUntil(NOW)).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(() => pending.worked(NOW)).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(() =>
        pending.failedWith(HookFailure.of('errored', 'x'), NOW, false),
      ).toThrow(InvalidHookFiringTransitionError);
      expect(() => pending.stopForLoop(LOOP)).toThrow(
        InvalidHookFiringTransitionError,
      );
    });
  });

  describe('failing', () => {
    it('is tried again later after a failure that may be retried', () => {
      const failed = working().failedWith(
        HookFailure.of('server-error', 'was answered 503'),
        NOW,
        false,
      );

      expect(failed.progress).toEqual({ kind: 'pending', dueAt: later(2_000) });
      expect(failed.attempts).toBe(1);
      expect(failed.failure?.code).toBe('server-error');
      expect(failed.retries(HookFailure.of('server-error', 'x'), NOW)).toBe(
        true,
      );
    });

    it('ends failed after its last attempt', () => {
      let firing = working();

      for (let attempt = 0; attempt < 7; attempt += 1) {
        firing = kept(
          firing.failedWith(HookFailure.of('timeout', 'slow'), NOW, false),
        ).claimed(later(60 * 60_000));
      }

      const ended = firing.failedWith(
        HookFailure.of('timeout', 'slow'),
        NOW,
        false,
      );

      expect(ended.progress).toEqual({ kind: 'failed', at: NOW });
      expect(ended.attempts).toBe(8);
    });

    it('ends at once on a failure that may not be retried', () => {
      const ended = working().failedWith(
        HookFailure.of('rejected', 'was answered 404'),
        NOW,
        false,
      );

      expect(ended.progress).toEqual({ kind: 'failed', at: NOW });
      expect(ended.failure?.code).toBe('rejected');
    });

    it('ends superseded when its task moved on from where it fired', () => {
      const ended = working().failedWith(
        HookFailure.of('rejected', 'was answered 404'),
        NOW,
        true,
      );

      expect(ended.progress).toEqual({ kind: 'superseded', at: NOW });
      expect(ended.failure).toEqual(
        HookFailure.of('superseded', 'was answered 404'),
      );
    });

    it('ends superseded when what it was about is gone', () => {
      expect(
        working().failedWith(
          HookFailure.of('superseded', 'its task is gone'),
          NOW,
          false,
        ).progress.kind,
      ).toBe('superseded');
    });
  });

  describe('guarding against loops', () => {
    const looped = CausalChain.none()
      .followedBy(MOVED)
      .followedBy(AUDIT)
      .followedBy(MOVED);

    it('is stopped when its own firing caused it again', () => {
      expect(working(fired(looped)).loopStop('audit', 0)?.code).toBe('loop');
    });

    it('is stopped when it keeps firing for the same change', () => {
      expect(working().loopStop('audit', 3)?.reason).toContain(
        'fired 3 times for the same change',
      );
      expect(working().loopStop('audit', 2)).toBeNull();
    });

    it('is never stopped once partway through its steps', () => {
      expect(
        working(fired(looped)).recordStep([DONE_A]).loopStop('audit', 9),
      ).toBeNull();
    });

    it('keeps a stop, however its chain reads later', () => {
      const stopped = working().stopForLoop(LOOP);

      expect(stopped.stoppedForLooping).toBe(true);
      expect(stopped.loopStop('audit', 0)).toBe(LOOP);
      expect(stopped.stopForLoop(HookFailure.of('loop', 'other'))).toBe(
        stopped,
      );
    });

    it('is stopped only by a loop', () => {
      expect(() =>
        working().stopForLoop(HookFailure.of('errored', 'x')),
      ).toThrow(InvalidHookFiringTransitionError);
    });

    it('ends as a loop once told of, or superseded when nobody is there to tell', () => {
      const stopped = working().stopForLoop(LOOP);

      expect(stopped.toldOfLoop(NOW, false).failure).toBe(LOOP);
      expect(stopped.toldOfLoop(NOW, false).progress.kind).toBe('failed');
      expect(stopped.toldOfLoop(NOW, true).progress.kind).toBe('superseded');
    });

    it('is not told of as a loop before it is stopped for one', () => {
      expect(() => working().toldOfLoop(NOW, false)).toThrow(
        InvalidHookFiringTransitionError,
      );
    });

    it('keeps its stop to tell of again when something fails before it is told', () => {
      const stopped = working().stopForLoop(LOOP);
      const again = stopped.failedWith(
        HookFailure.of('errored', 'db went away'),
        NOW,
        true,
      );

      expect(again.progress).toEqual({ kind: 'pending', dueAt: later(2_000) });
      expect(again.failure).toBe(LOOP);
    });

    it('ends as a loop when it could never be told of', () => {
      const stopped = HookFiring.rehydrate({
        ...stateOf(working().stopForLoop(LOOP)),
        attempts: 7,
        version: 1,
      });

      expect(
        stopped.failedWith(HookFailure.of('errored', 'x'), NOW, true).failure,
      ).toBe(LOOP);
    });

    it('lets a failure that may never be retried end a stop still to be told of', () => {
      const stopped = working().stopForLoop(LOOP);

      expect(
        stopped.failedWith(HookFailure.of('broken', 'unreadable'), NOW, false)
          .failure?.code,
      ).toBe('broken');
    });
  });

  describe('being forgotten', () => {
    it('is forgotten thirty days after it finishes', () => {
      const done = kept(working().worked(NOW));
      const month = later(30 * 24 * 60 * 60_000);

      expect(done.isForgettableAt(later(1))).toBe(false);
      expect(() => done.forgotten(later(1))).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(done.forgotten(month).isDiscarded).toBe(true);
      expect(HookFiring.finishedForgettablyBefore(month)).toEqual(NOW);
    });

    it('is never forgotten while still owed', () => {
      expect(kept(fired()).isForgettableAt(later(365 * 24 * 60 * 60_000))).toBe(
        false,
      );
    });
  });

  describe('as kept', () => {
    it('rejects a firing kept without a version', () => {
      expect(() => kept(fired(), 0)).toThrow(InconsistentStateError);
    });

    it('rejects a failed firing that says no failure', () => {
      expect(() =>
        HookFiring.rehydrate({
          ...stateOf(fired()),
          progress: { kind: 'failed', at: NOW },
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
    });
  });
});
