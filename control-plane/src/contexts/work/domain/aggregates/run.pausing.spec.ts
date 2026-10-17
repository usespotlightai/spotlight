import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@work/domain/events/run-lease-expired.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunResumed } from '@work/domain/events/run-resumed.event';
import { RunSuspended } from '@work/domain/events/run-suspended.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);

const RUNNER = RunnerId.of('runner_1');
const OTHER = RunnerId.of('runner_2');
const CLEAN = RunOutcome.of({ exitCode: 0, failed: false });
const ASKED = HandoverReport.of({
  handover: Handover.of({ next: 'review', note: 'Which queue?' }),
  session: HarnessSession.of('session_1'),
});

const claimed = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task_1:station_1' },
    }),
  }).claim(RUNNER, NOW);

const waiting = () => claimed().paused(RUNNER, CLEAN, ASKED, NOW);

const suspended = () => waiting().suspend(RUNNER, later(60_000));

const lastEvent = (run: Run) => {
  const events = run.pullEvents();

  return events[events.length - 1];
};

describe('a run that asks a person', () => {
  describe('pausing', () => {
    it('waits for the answer instead of ending, still leased by its runner', () => {
      const run = waiting();

      expect(run.state).toBe('waiting');
      expect(run.hasEnded).toBe(false);
      expect(run.isLeasedBy(RUNNER)).toBe(true);
      expect(run.waitsForAPerson).toBe(true);
    });

    it('says what the turn ended with, so the task is put to the person', () => {
      expect(waiting().pullEvents()).toEqual([
        new RunPaused(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          null,
          RUNNER,
          CLEAN,
          ASKED.handover,
          ASKED.session,
          1,
          NOW,
        ),
      ]);
    });

    it('remembers the session it paused in, for a runner that takes it up later', () => {
      expect(waiting().spec.value.continuity).toEqual({
        key: 'task_1:station_1',
        sessionId: 'session_1',
        resumes: true,
      });
      expect(waiting().restoresFrom?.value).toBe('task_1:station_1');
    });

    it('keeps its lease while it waits, and lets its runner renew it and journal', () => {
      const run = waiting();

      expect(run.leaseExpiresAt?.getTime()).toBeGreaterThan(NOW.getTime());
      expect(run.renewLease(RUNNER, later(30_000)).state).toBe('waiting');
      expect(run.journalFor(RUNNER)).toEqual(
        RunAttempt.of(RunId.of('run_1'), 1),
      );
    });

    it('does not wait on a turn that failed or was stopped', () => {
      expect(() =>
        claimed().paused(
          RUNNER,
          RunOutcome.of({ exitCode: 1, failed: true }),
          ASKED,
          NOW,
        ),
      ).toThrow(InvalidRunTransitionError);
      expect(() =>
        claimed().paused(RUNNER, RunOutcome.stopped(130), ASKED, NOW),
      ).toThrow(InvalidRunTransitionError);
    });

    it('does not wait once a person requested it to stop', () => {
      expect(() =>
        claimed().requestStop(NOW).paused(RUNNER, CLEAN, ASKED, NOW),
      ).toThrow(InvalidRunTransitionError);
    });

    it('is paused only by the runner that leases it, and only while working', () => {
      expect(() => claimed().paused(OTHER, CLEAN, ASKED, NOW)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => waiting().paused(RUNNER, CLEAN, ASKED, NOW)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('answered while it waits warm', () => {
    it('goes back to work on the same attempt, still leased by its runner', () => {
      const run = waiting().resumed();

      expect(run.state).toBe('claimed');
      expect(run.attempt).toBe(1);
      expect(run.isLeasedBy(RUNNER)).toBe(true);
      expect(lastEvent(run)).toEqual(
        new RunResumed(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          null,
          1,
          true,
        ),
      );
    });

    it('is not suspended afterwards: suspending leaves it working for the answer to be given', () => {
      const run = waiting().resumed();

      const after = run.suspend(RUNNER, later(60_000));

      expect(after).toBe(run);
      expect(after.state).toBe('claimed');
    });

    it('can pause again at the end of a later turn', () => {
      const run = waiting().resumed().paused(RUNNER, CLEAN, ASKED, NOW);

      expect(run.state).toBe('waiting');
      expect(run.attempt).toBe(1);
    });
  });

  describe('suspending once the grace period ends', () => {
    it('releases its runner and keeps the attempt, so its journal still shows it', () => {
      const run = suspended();

      expect(run.state).toBe('suspended');
      expect(run.claimedBy).toBeNull();
      expect(run.leaseExpiresAt).toBeNull();
      expect(run.suspendedAttempts).toEqual([1]);
      expect(run.hasEnded).toBe(false);
      expect(run.waitsForAPerson).toBe(true);
    });

    it('says the runner left it, so its secrets and its runner are released', () => {
      expect(lastEvent(waiting().suspend(RUNNER, later(60_000)))).toEqual(
        new RunSuspended(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          RUNNER,
          later(60_000),
          1,
        ),
      );
    });

    it('is suspended only by the runner that leases it', () => {
      expect(() => waiting().suspend(OTHER, NOW)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => suspended().suspend(RUNNER, NOW)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('ends stopped instead when a person requested it to stop while it waited', () => {
      const run = waiting().requestStop(NOW).suspend(RUNNER, later(60_000));

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(true);
      expect(lastEvent(run)).toBeInstanceOf(RunCompleted);
    });
  });

  describe('answered once suspended', () => {
    it('goes back on the queue as its next attempt, for any runner to take up from the archive', () => {
      const run = suspended().resumed();

      expect(run.state).toBe('queued');
      expect(run.attempt).toBe(2);
      expect(run.suspendedAttempts).toEqual([1]);
      expect(run.spec.resumes).toBe(true);
      expect(run.restoresFrom?.value).toBe('task_1:station_1');
      expect(lastEvent(run)).toEqual(
        new RunResumed(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          null,
          2,
          false,
        ),
      );
    });

    it('is claimed by another runner on its new attempt', () => {
      const run = suspended().resumed().claim(OTHER, later(120_000));

      expect(run.isLeasedBy(OTHER)).toBe(true);
      expect(run.journalFor(OTHER)).toEqual(
        RunAttempt.of(RunId.of('run_1'), 2),
      );
    });

    it('does not count waiting for a person against the attempts a lost runner is given', () => {
      let run = suspended().resumed();

      for (let times = 0; times < 2; times++) {
        run = run.claim(RUNNER, NOW).paused(RUNNER, CLEAN, ASKED, NOW);
        run = run.suspend(RUNNER, NOW).resumed();
      }

      const lost = run.claim(RUNNER, NOW);
      const requeued = lost.expireLease(lost.leaseExpiresAt as Date);

      expect(requeued.state).toBe('queued');
    });
  });

  it('says how many runners it lost, not how many attempts it made, when it is exhausted', () => {
    let run = suspended().resumed();

    for (let lost = 0; lost < 3; lost++) {
      run.pullEvents();
      const reclaimed = run.claim(RUNNER, NOW);
      run = reclaimed.expireLease(reclaimed.leaseExpiresAt as Date);
    }

    const exhausted = run
      .pullEvents()
      .find((each) => each instanceof RunExhausted) as RunExhausted;

    expect(run.state).toBe('failed');
    expect(exhausted.attempt).toBe(4);
    expect(exhausted.expiredLeases).toBe(3);
  });

  it('goes back on the queue from its archive when its runner, harness already closed, suspends it after the answer came', () => {
    const run = waiting().resumed().suspend(RUNNER, later(60_000), true);

    expect(run.state).toBe('queued');
    expect(run.attempt).toBe(2);
    expect(run.suspendedAttempts).toEqual([1]);
    expect(run.spec.resumes).toBe(true);
    expect(lastEvent(run)).toBeInstanceOf(RunSuspended);
  });

  it('ends stopped rather than go back on the queue when a stop was requested before it was suspended to be requeued', () => {
    const run = waiting()
      .resumed()
      .requestStop(NOW)
      .suspend(RUNNER, later(60_000), true);

    expect(run.state).toBe('completed');
    expect(run.outcome?.stopped).toBe(true);
  });

  it('is suspended to be requeued only once an answer resumed it from a pause', () => {
    expect(() => claimed().suspend(RUNNER, NOW, true)).toThrow(
      InvalidRunTransitionError,
    );
  });

  describe('the one order when the grace period ends', () => {
    it('lets the answer reach the live session when it comes before the run is suspended', () => {
      const answered = waiting().resumed();

      expect(answered.state).toBe('claimed');
      expect(answered.suspend(RUNNER, later(60_000)).isLeasedBy(RUNNER)).toBe(
        true,
      );
    });

    it('requeues from the archive when the answer comes once the run is suspended', () => {
      expect(suspended().resumed().state).toBe('queued');
    });

    it('cannot be taken up twice by one answer', () => {
      expect(() => waiting().resumed().resumed()).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => suspended().resumed().resumed()).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('when a person stops it while it waits', () => {
    it('gets a stop request while warm, so its runner ends it stopped', () => {
      const run = waiting().requestStop(NOW);

      expect(run.stopRequested).toBe(true);
      expect(run.resumable).toBe(false);
      expect(() => run.resumed()).toThrow(InvalidRunTransitionError);
      expect(run.complete(RUNNER, RunOutcome.stopped(0)).state).toBe(
        'completed',
      );
    });

    it('ends stopped at once when a person stops it while suspended', () => {
      const run = suspended().requestStop(NOW);

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(true);
      expect(lastEvent(run)).toBeInstanceOf(RunCompleted);
    });
  });

  describe('cancelled by its task', () => {
    it('ends as its paused turn ended, whether waiting warm or suspended', () => {
      for (const paused of [waiting(), suspended()]) {
        const ended = paused.cancel(NOW);

        expect(ended.state).toBe('completed');
        expect(ended.outcome).toEqual(CLEAN);
        expect(lastEvent(ended)).toBeInstanceOf(RunCompleted);
      }
    });

    it('requests a working run to stop, and cancels one still queued', () => {
      expect(claimed().cancel(NOW).stopRequested).toBe(true);
      expect(
        Run.enqueue({
          id: RunId.of('run_2'),
          workspaceId: WorkspaceId.of('ws_1'),
          harness: HarnessId.of('dev'),
          spec: claimed().spec,
        }).cancel(NOW).state,
      ).toBe('cancelled');
    });

    it('carries the outcome of its paused turn until it is taken up again', () => {
      expect(waiting().outcome).toEqual(CLEAN);
      expect(waiting().resumed().outcome).toBeNull();
      expect(suspended().resumed().outcome).toBeNull();
    });
  });

  describe('losing its runner while it waits warm', () => {
    it('is suspended rather than going back on the queue, keeping the attempt', () => {
      const run = waiting();
      const expiredAt = run.leaseExpiresAt as Date;

      const lost = run.expireLease(expiredAt);

      expect(lost.state).toBe('suspended');
      expect(lost.attempt).toBe(1);
      expect(lost.suspendedAttempts).toEqual([1]);
      expect(lastEvent(lost)).toEqual(
        new RunLeaseExpired(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          RUNNER,
          expiredAt,
          1,
        ),
      );
    });
  });

  it('reads back as it was stored while waiting or suspended, and never leased when suspended', () => {
    expect(Run.rehydrate({ ...waiting() }).state).toBe('waiting');
    expect(Run.rehydrate({ ...suspended() }).suspendedAttempts).toEqual([1]);
    expect(() => Run.rehydrate({ ...waiting(), claimedBy: null })).toThrow();
    expect(() =>
      Run.rehydrate({ ...suspended(), claimedBy: RUNNER }),
    ).toThrow();
  });
});
