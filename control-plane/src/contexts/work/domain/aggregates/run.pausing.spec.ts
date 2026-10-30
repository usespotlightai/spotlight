import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
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
      resume: { key: 'task_1:station_1' },
    }),
  }).claim(RUNNER, NOW);

const suspended = () => claimed().suspend(RUNNER, CLEAN, ASKED, NOW);

const lastEvent = (run: Run) => {
  const events = run.pullEvents();

  return events[events.length - 1];
};

describe('a run that asks a person', () => {
  describe('suspending', () => {
    it('leaves its lease at once instead of ending, keeping the attempt', () => {
      const run = suspended();

      expect(run.state).toBe('suspended');
      expect(run.hasEnded).toBe(false);
      expect(run.claimedBy).toBeNull();
      expect(run.leaseExpiresAt).toBeNull();
      expect(run.isLeasedBy(RUNNER)).toBe(false);
      expect(run.suspendedAttempts).toEqual([1]);
    });

    it('says what the turn ended with, and that its runner left it, so its secrets, runner and sandbox lease are released', () => {
      expect(suspended().pullEvents()).toEqual([
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
          false,
        ),
        new RunSuspended(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          RUNNER,
          NOW,
          1,
        ),
      ]);
    });

    it('remembers the session it was suspended in, for the run that takes it up', () => {
      expect(suspended().spec.value.resume).toEqual({
        key: 'task_1:station_1',
        sessionId: 'session_1',
        resumeSession: true,
      });
      expect(suspended().restoresFrom?.value).toBe('task_1:station_1');
    });

    it('lets its runner renew or journal it no more', () => {
      expect(() => suspended().renewLease(RUNNER, later(30_000))).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => suspended().journalFor(RUNNER)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('is not suspended on a turn that failed or was stopped', () => {
      expect(() =>
        claimed().suspend(
          RUNNER,
          RunOutcome.of({ exitCode: 1, failed: true }),
          ASKED,
          NOW,
        ),
      ).toThrow(InvalidRunTransitionError);
      expect(() =>
        claimed().suspend(RUNNER, RunOutcome.stopped(130), ASKED, NOW),
      ).toThrow(InvalidRunTransitionError);
    });

    it('is not suspended once a person requested it to stop', () => {
      expect(() =>
        claimed().requestStop(NOW).suspend(RUNNER, CLEAN, ASKED, NOW),
      ).toThrow(InvalidRunTransitionError);
    });

    it('is suspended only by the runner that leases it, and only while working', () => {
      expect(() => claimed().suspend(OTHER, CLEAN, ASKED, NOW)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => suspended().suspend(RUNNER, CLEAN, ASKED, NOW)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('answered', () => {
    it('goes back on the queue as its next attempt, to resume its session', () => {
      const run = suspended().resumed();

      expect(run.state).toBe('queued');
      expect(run.attempt).toBe(2);
      expect(run.suspendedAttempts).toEqual([1]);
      expect(run.spec.resumesSession).toBe(true);
      expect(run.outcome).toBeNull();
      expect(lastEvent(run)).toEqual(
        new RunResumed(RunId.of('run_1'), WorkspaceId.of('ws_1'), null, 2),
      );
    });

    it('is claimed by a runner on its new attempt', () => {
      const run = suspended().resumed().claim(OTHER, later(120_000));

      expect(run.isLeasedBy(OTHER)).toBe(true);
      expect(run.journalFor(OTHER)).toEqual(
        RunAttempt.of(RunId.of('run_1'), 2),
      );
    });

    it('cannot be taken up twice by one answer', () => {
      const run = suspended().resumed();

      expect(run.resumable).toBe(false);
      expect(() => run.resumed()).toThrow(InvalidRunTransitionError);
    });

    it('does not count waiting for a person against the attempts a lost runner is given', () => {
      let run = suspended().resumed();

      for (let times = 0; times < 2; times++) {
        run = run
          .claim(RUNNER, NOW)
          .suspend(RUNNER, CLEAN, ASKED, NOW)
          .resumed();
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

  it('ends stopped at once when a person stops it while suspended', () => {
    const run = suspended().requestStop(NOW);

    expect(run.state).toBe('completed');
    expect(run.outcome?.stopped).toBe(true);
    expect(lastEvent(run)).toBeInstanceOf(RunCompleted);
  });

  describe('cancelled by its task', () => {
    it('ends as its suspended turn ended', () => {
      const ended = suspended().cancel(NOW);

      expect(ended.state).toBe('completed');
      expect(ended.outcome).toEqual(CLEAN);
      expect(lastEvent(ended)).toBeInstanceOf(RunCompleted);
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
  });

  it('reads back as it was stored while suspended, and never leased', () => {
    expect(Run.rehydrate({ ...suspended() }).suspendedAttempts).toEqual([1]);
    expect(() =>
      Run.rehydrate({ ...suspended(), claimedBy: RUNNER }),
    ).toThrow();
  });
});
