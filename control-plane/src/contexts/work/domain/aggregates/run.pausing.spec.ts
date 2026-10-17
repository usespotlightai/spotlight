import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunLapsed } from '@work/domain/events/run-lapsed.event';
import { RunParked } from '@work/domain/events/run-parked.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunResumed } from '@work/domain/events/run-resumed.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
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
  declared: Declaration.of({ next: 'review', note: 'Which queue?' }),
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

const parked = () => waiting().park(RUNNER, later(60_000));

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
          ASKED.declared,
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

    it('refuses to wait on a turn that failed or was stopped', () => {
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

    it('refuses to wait once a person asked it to stop', () => {
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

    it('is not parked afterwards: parking leaves it working for the answer to be given', () => {
      const run = waiting().resumed();

      const after = run.park(RUNNER, later(60_000));

      expect(after).toBe(run);
      expect(after.state).toBe('claimed');
    });

    it('can pause again at the end of a later turn', () => {
      const run = waiting().resumed().paused(RUNNER, CLEAN, ASKED, NOW);

      expect(run.state).toBe('waiting');
      expect(run.attempt).toBe(1);
    });
  });

  describe('parking once the grace period ends', () => {
    it('lets its runner go and keeps the attempt, so its journal still shows it', () => {
      const run = parked();

      expect(run.state).toBe('parked');
      expect(run.claimedBy).toBeNull();
      expect(run.leaseExpiresAt).toBeNull();
      expect(run.parkedAttempts).toEqual([1]);
      expect(run.hasEnded).toBe(false);
      expect(run.waitsForAPerson).toBe(true);
    });

    it('says the runner left it, so its secrets and its runner are let go', () => {
      expect(lastEvent(waiting().park(RUNNER, later(60_000)))).toEqual(
        new RunParked(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          RUNNER,
          later(60_000),
          1,
        ),
      );
    });

    it('is parked only by the runner that leases it', () => {
      expect(() => waiting().park(OTHER, NOW)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => parked().park(RUNNER, NOW)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('ends stopped instead when a person asked it to stop while it waited', () => {
      const run = waiting().requestStop(NOW).park(RUNNER, later(60_000));

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(true);
      expect(lastEvent(run)).toBeInstanceOf(RunCompleted);
    });
  });

  describe('answered once parked', () => {
    it('goes back on the queue as its next attempt, for any runner to take up from the archive', () => {
      const run = parked().resumed();

      expect(run.state).toBe('queued');
      expect(run.attempt).toBe(2);
      expect(run.parkedAttempts).toEqual([1]);
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
      const run = parked().resumed().claim(OTHER, later(120_000));

      expect(run.isLeasedBy(OTHER)).toBe(true);
      expect(run.journalFor(OTHER)).toEqual(
        RunAttempt.of(RunId.of('run_1'), 2),
      );
    });

    it('does not count waiting for a person against the attempts a lost runner is given', () => {
      let run = parked().resumed();

      for (let times = 0; times < 2; times++) {
        run = run.claim(RUNNER, NOW).paused(RUNNER, CLEAN, ASKED, NOW);
        run = run.park(RUNNER, NOW).resumed();
      }

      const lost = run.claim(RUNNER, NOW);
      const requeued = lost.requeue(lost.leaseExpiresAt as Date);

      expect(requeued.state).toBe('queued');
    });
  });

  it('says how many runners it lost, not how many attempts it took, when it is given up on', () => {
    let run = parked().resumed();

    for (let lost = 0; lost < 3; lost++) {
      run.pullEvents();
      const reclaimed = run.claim(RUNNER, NOW);
      run = reclaimed.requeue(reclaimed.leaseExpiresAt as Date);
    }

    const abandoned = run
      .pullEvents()
      .find((each) => each instanceof RunAbandoned) as RunAbandoned;

    expect(run.state).toBe('failed');
    expect(abandoned.attempt).toBe(4);
    expect(abandoned.lapses).toBe(3);
  });

  it('goes back on the queue from its archive when its runner, harness already closed, parks it after the answer came', () => {
    const run = waiting().resumed().park(RUNNER, later(60_000), true);

    expect(run.state).toBe('queued');
    expect(run.attempt).toBe(2);
    expect(run.parkedAttempts).toEqual([1]);
    expect(run.spec.resumes).toBe(true);
    expect(lastEvent(run)).toBeInstanceOf(RunParked);
  });

  it('ends stopped rather than go back on the queue when a stop was asked for before it was parked cold', () => {
    const run = waiting()
      .resumed()
      .requestStop(NOW)
      .park(RUNNER, later(60_000), true);

    expect(run.state).toBe('completed');
    expect(run.outcome?.stopped).toBe(true);
  });

  it('is parked cold only once an answer took it up from a pause', () => {
    expect(() => claimed().park(RUNNER, NOW, true)).toThrow(
      InvalidRunTransitionError,
    );
  });

  describe('the one order when the grace period ends', () => {
    it('lets the answer reach the live session when it comes before the run is parked', () => {
      const answered = waiting().resumed();

      expect(answered.state).toBe('claimed');
      expect(answered.park(RUNNER, later(60_000)).isLeasedBy(RUNNER)).toBe(
        true,
      );
    });

    it('requeues from the archive when the answer comes once the run is parked', () => {
      expect(parked().resumed().state).toBe('queued');
    });

    it('cannot be taken up twice by one answer', () => {
      expect(() => waiting().resumed().resumed()).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => parked().resumed().resumed()).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('when a person stops it while it waits', () => {
    it('is asked to stop while warm, so its runner ends it stopped', () => {
      const run = waiting().requestStop(NOW);

      expect(run.stopRequested).toBe(true);
      expect(run.resumable).toBe(false);
      expect(() => run.resumed()).toThrow(InvalidRunTransitionError);
      expect(run.complete(RUNNER, RunOutcome.stopped(0)).state).toBe(
        'completed',
      );
    });

    it('ends stopped at once when a person stops it while parked', () => {
      const run = parked().requestStop(NOW);

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(true);
      expect(lastEvent(run)).toBeInstanceOf(RunCompleted);
    });
  });

  describe('let go of by its task', () => {
    it('ends as its paused turn ended, whether waiting warm or parked', () => {
      for (const paused of [waiting(), parked()]) {
        const ended = paused.letGo(NOW);

        expect(ended.state).toBe('completed');
        expect(ended.outcome).toEqual(CLEAN);
        expect(lastEvent(ended)).toBeInstanceOf(RunCompleted);
      }
    });

    it('asks a working run to stop, and withdraws one still queued', () => {
      expect(claimed().letGo(NOW).stopRequested).toBe(true);
      expect(
        Run.enqueue({
          id: RunId.of('run_2'),
          workspaceId: WorkspaceId.of('ws_1'),
          harness: HarnessId.of('dev'),
          spec: claimed().spec,
        }).letGo(NOW).state,
      ).toBe('superseded');
    });

    it('carries the outcome of its paused turn until it is taken up again', () => {
      expect(waiting().outcome).toEqual(CLEAN);
      expect(waiting().resumed().outcome).toBeNull();
      expect(parked().resumed().outcome).toBeNull();
    });
  });

  describe('losing its runner while it waits warm', () => {
    it('parks rather than going back on the queue, keeping the attempt', () => {
      const run = waiting();
      const lapsedAt = run.leaseExpiresAt as Date;

      const lost = run.requeue(lapsedAt);

      expect(lost.state).toBe('parked');
      expect(lost.attempt).toBe(1);
      expect(lost.parkedAttempts).toEqual([1]);
      expect(lastEvent(lost)).toEqual(
        new RunLapsed(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          RUNNER,
          lapsedAt,
          1,
        ),
      );
    });
  });

  it('reads back as it was stored while waiting or parked, and never leased when parked', () => {
    expect(Run.rehydrate({ ...waiting() }).state).toBe('waiting');
    expect(Run.rehydrate({ ...parked() }).parkedAttempts).toEqual([1]);
    expect(() => Run.rehydrate({ ...waiting(), claimedBy: null })).toThrow();
    expect(() => Run.rehydrate({ ...parked(), claimedBy: RUNNER })).toThrow();
  });
});
