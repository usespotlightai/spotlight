import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { orderedFor } from '@work/domain/aggregates/run.fake-spec';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
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

const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const RUNNER = RunnerId.of('runner_1');
const OTHER = RunnerId.of('runner_2');
const CLEAN = RunOutcome.of({ exitCode: 0, failed: false });
const ASKED = HandoverReport.of({
  handover: Handover.of({ next: 'review', note: 'Which queue?' }),
  session: HarnessSession.of('session_1'),
});
const claimed = (ordering = orderedFor.task('task_1', 0)) =>
  Run.enqueue({
    id: RUN,
    workspaceId: WORKSPACE,
    harness: HarnessId.of('dev'),
    ...ordering,
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    }),
  }).claim(RUNNER, NOW);

const pending = () => claimed().reportTurn(RUNNER, CLEAN, ASKED, NOW);

const kept = () => pending().keep(1);

const events = (run: Run) => [...run.pullEvents()];

describe('the turn of a run that holds it', () => {
  describe('handed over', () => {
    it('suspends at once, leaving its lease, and waits for its requester to decide', () => {
      const run = pending();

      expect(run.state).toBe('suspended');
      expect(run.hasEnded).toBe(false);
      expect(run.claimedBy).toBeNull();
      expect(run.isLeasedBy(RUNNER)).toBe(false);
      expect(run.suspendedAttempts).toEqual([1]);
      expect(run.turnAt(1)?.state).toBe('pending');
      expect(run.turnAt(1)?.report.equals(ASKED)).toBe(true);
      expect(run.turnAt(1)?.reportedBy.equals(RUNNER)).toBe(true);
      expect(run.turnAt(1)?.suspendedAt).toEqual(NOW);
      expect(run.turnAt(2)).toBeNull();
      expect(run.spec.resumesSession).toBe(true);
    });

    it('says only that its runner left it, so its secrets, runner and sandbox are released', () => {
      expect(events(pending())).toEqual([
        new RunSuspended(RUN, WORKSPACE, RUNNER, NOW, 1),
      ]);
    });

    it('suspends under a stop request too, so the hand-over still goes through its requester', () => {
      const run = claimed()
        .requestStop(NOW)
        .reportTurn(RUNNER, CLEAN, ASKED, later(1_000));

      expect(run.state).toBe('suspended');
      expect(run.stopRequested).toBe(true);
    });

    it('completes, as reported, a turn that failed or was stopped', () => {
      const failed = claimed().reportTurn(
        RUNNER,
        RunOutcome.of({ exitCode: 1, failed: true }),
        ASKED,
        NOW,
      );
      const [ended] = events(failed);

      expect(failed.state).toBe('failed');
      expect(ended).toBeInstanceOf(RunCompleted);
      expect((ended as RunCompleted).reported).toBe(true);
      expect(
        claimed().reportTurn(RUNNER, RunOutcome.stopped(130), ASKED, NOW).state,
      ).toBe('completed');
    });

    it('completes the turn of a run that does not hold it, such as a chat’s', () => {
      const run = claimed(orderedFor.chat('chat_1')).reportTurn(
        RUNNER,
        CLEAN,
        ASKED,
        NOW,
      );

      expect(run.state).toBe('completed');
      expect(run.turn).toBeNull();
    });

    it('is reported only by the runner that leases it', () => {
      expect(() => claimed().reportTurn(OTHER, CLEAN, ASKED, NOW)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => pending().reportTurn(RUNNER, CLEAN, ASKED, NOW)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('lets its runner renew or journal it no more', () => {
      expect(() => pending().renewLease(RUNNER, later(30_000))).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => pending().journalFor(RUNNER)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('kept for a person', () => {
    it('waits for the person, marking the pause at the time it handed over', () => {
      const pendingRun = pending();
      pendingRun.pullEvents();
      const run = pendingRun.keep(1);

      expect(run.turnAt(1)?.state).toBe('kept');
      expect(events(run)).toEqual([
        new RunPaused(RUN, WORKSPACE, 1, NOW, false),
      ]);
    });

    it('is kept once, and never for another attempt', () => {
      const run = kept();

      expect(run.keep(1)).toBe(run);
      expect(pending().keep(2).turnAt(1)?.state).toBe('pending');
    });

    it('ends stopped when a stop came in while its requester decided', () => {
      const run = pending().requestStop(later(1_000)).keep(1);

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(true);
    });
  });

  describe('resumed', () => {
    it('goes back on the queue as its next attempt when messages came in during the turn', () => {
      const pendingRun = pending();
      pendingRun.pullEvents();
      const run = pendingRun.resumed(1, 'messages', [], later(5_000));

      expect(run.state).toBe('queued');
      expect(run.attempt).toBe(2);
      expect(run.turn).toBeNull();
      expect(run.spec.resumesSession).toBe(true);
      expect(events(run)).toEqual([
        new RunPaused(RUN, WORKSPACE, 1, later(5_000), true),
      ]);
    });

    it('goes back on the queue when a person answered the turn it kept, marking no second pause', () => {
      const keptRun = kept();
      keptRun.pullEvents();
      const run = keptRun.resumed(null, 'answered', [], later(60_000));

      expect(run.attempt).toBe(2);
      expect(events(run)).toEqual([]);
    });

    it('marks the pause it never marked when an answer comes before its requester kept it', () => {
      const pendingRun = pending();
      pendingRun.pullEvents();
      const run = pendingRun.resumed(1, 'answered', [], later(60_000));

      expect(run.attempt).toBe(2);
      expect(events(run)).toEqual([
        new RunPaused(RUN, WORKSPACE, 1, NOW, false),
      ]);
    });

    it('is never resumed by an answer that was not to its turn while its requester still decides', () => {
      const run = pending();

      expect(run.resumed(null, 'answered', [], later(1_000))).toBe(run);
    });

    it('is resumed once, never for an older attempt', () => {
      const run = kept().resumed(1, 'answered', [], later(1_000));

      expect(run.resumed(1, 'answered', [], later(2_000))).toBe(run);
      expect(run.keep(1)).toBe(run);
      expect(run.finished(1)).toBe(run);
    });

    it('checks out on its new attempt the repositories its line gained, beside the ones it has', () => {
      const joining = [{ remote: 'spotlight:repository', path: 'config' }];

      expect(
        kept().resumed(1, 'answered', joining, NOW).spec.checkoutFolders,
      ).toEqual([...pending().spec.checkoutFolders, 'config']);
    });

    it('is claimed by a runner on its new attempt', () => {
      const run = kept()
        .resumed(1, 'answered', [], NOW)
        .claim(OTHER, later(120_000));

      expect(run.journalFor(OTHER)).toEqual(RunAttempt.of(RUN, 2));
    });

    it('ends stopped instead when a stop came in during the turn', () => {
      const run = pending()
        .requestStop(later(1_000))
        .resumed(1, 'messages', [], later(2_000));

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(true);
    });

    it('does not count waiting for a person against the attempts a lost runner is given', () => {
      let run = kept().resumed(1, 'answered', [], NOW);

      for (let times = 0; times < 2; times++) {
        run = run
          .claim(RUNNER, NOW)
          .reportTurn(RUNNER, CLEAN, ASKED, NOW)
          .keep(run.attempt)
          .resumed(null, 'answered', [], NOW);
      }

      const lost = run.claim(RUNNER, NOW);

      expect(lost.expireLease(lost.leaseExpiresAt as Date).state).toBe(
        'queued',
      );
    });
  });

  describe('finished', () => {
    it('completes as it reported, ended when it handed over, telling nothing more', () => {
      const pendingRun = pending();
      pendingRun.pullEvents();
      const run = pendingRun.finished(1);
      const [ended] = events(run);

      expect(run.state).toBe('completed');
      expect(run.outcome).toEqual(CLEAN);
      expect(run.endedAt).toEqual(NOW);
      expect(run.turn).toBeNull();
      expect(ended).toEqual(
        new RunCompleted(
          RUN,
          WORKSPACE,
          orderedFor.task('task_1', 0).requester,
          CLEAN,
          RUNNER,
          null,
          null,
          1,
          false,
          false,
          false,
        ),
      );
    });

    it('completes as reported though a stop came in during the turn', () => {
      const run = pending().requestStop(later(1_000)).finished(1);

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(false);
    });

    it('finishes only the turn of its attempt', () => {
      const run = pending();

      expect(run.finished(2)).toBe(run);
    });
  });

  describe('stopped', () => {
    it('only records the stop while its requester decides, so the hand-over is not dropped', () => {
      const pendingRun = pending();
      pendingRun.pullEvents();
      const run = pendingRun.requestStop(later(1_000));

      expect(run.state).toBe('suspended');
      expect(run.stopRequested).toBe(true);
      expect(events(run)).toEqual([]);
      expect(run.requestStop(later(2_000))).toBe(run);
    });

    it('ends stopped at once when it waits for a person', () => {
      const run = kept().requestStop(later(1_000));

      expect(run.state).toBe('completed');
      expect(run.outcome?.stopped).toBe(true);
      expect(events(run).pop()).toBeInstanceOf(RunCompleted);
    });
  });

  describe('cancelled by its task', () => {
    it('ends as its turn ended, pending or kept', () => {
      for (const suspended of [pending(), kept()]) {
        const ended = suspended.cancel(NOW);

        expect(ended.state).toBe('completed');
        expect(ended.outcome).toEqual(CLEAN);
        expect(ended.turn).toBeNull();
        expect(events(ended).pop()).toBeInstanceOf(RunCompleted);
      }
    });
  });

  it('says how many runners it lost, not how many attempts it made, when it is exhausted', () => {
    let run = kept().resumed(1, 'answered', [], NOW);

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
    expect(exhausted.started).toBe(true);
  });

  it('reads back as stored: a turn only while suspended, and never leased', () => {
    const stored = (run: Run) => ({ ...run, ...run.ordered });

    expect(Run.rehydrate(stored(pending())).turnAt(1)?.state).toBe('pending');
    expect(() => Run.rehydrate({ ...stored(pending()), turn: null })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      Run.rehydrate({ ...stored(claimed()), turn: kept().turn }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      Run.rehydrate({ ...stored(pending()), claimedBy: RUNNER }),
    ).toThrow();
  });
});
