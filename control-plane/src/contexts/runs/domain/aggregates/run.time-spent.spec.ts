import { Run } from '@runs/domain/aggregates/run.aggregate';
import {
  claimer,
  leaseEndOf,
  orderedFor,
} from '@runs/domain/aggregates/run.fake-spec';
import { RunEnded } from '@runs/domain/events/run-ended.event';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { TimeSpent } from '@runs/domain/value-objects/time-spent.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);
const DAY_MS = 86_400_000;

const RUN = RunId.of('run_1');
const RUNNER = RunnerId.of('runner_1');
const IMAGE = RunnerImage.of(`ghcr.io/acme/widgets@sha256:${'a'.repeat(64)}`);
const CLEAN = RunOutcome.of({ exitCode: ExitCode.of(0), failed: false });
const ASKED = HandoverReport.of({
  handover: Handover.of({ next: 'review', note: 'Ready for review.' }),
  session: HarnessSession.of('session_1'),
});

const queued = () =>
  Run.enqueue({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.holdingTurn('task_1', 0),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    }),
    now: NOW,
  });

const startedAt = (run: Run, claimedAt: number, startedAtMs: number) =>
  run
    .claim(claimer(RUNNER), at(claimedAt))
    .startedIn(RUNNER, IMAGE, at(startedAtMs));

const keptAt = (run: Run, suspendedAt: number) =>
  run
    .reportTurn(RUNNER, CLEAN, ASKED, at(suspendedAt))
    .keep(run.attempt, at(suspendedAt + 1_000));

const firstTurn = () => keptAt(startedAt(queued(), 1_000, 2_000), 62_000);

describe('the time a run spends', () => {
  it('counts the queue up to its start and its work up to its hand-over', () => {
    const run = firstTurn();

    expect(run.spent.queuedMs).toBe(2_000);
    expect(run.spent.runningMs).toBe(60_000);
    expect(run.spent.firstStartedAt).toEqual(at(2_000));
  });

  it('leaves out the days a person takes to review a kept turn', () => {
    const { run } = firstTurn().cancel('Accepted.', at(2 * DAY_MS));
    const ended = run.pullEvents().find((each) => each instanceof RunEnded);

    expect(run.endedAt).toEqual(at(62_000));
    expect(ended?.endedAt).toEqual(at(62_000));
    expect(run.spent.runningMs).toBe(60_000);
  });

  it('adds every turn, and the queue of each, but not the wait between them', () => {
    const resumed = firstTurn().resumed(
      RunAttempt.of(RUN, 1),
      'messages',
      [],
      at(DAY_MS),
    );
    const second = startedAt(resumed, DAY_MS + 500, DAY_MS + 3_000);
    const ended = second.complete(
      RUNNER,
      CLEAN,
      HandoverReport.none(),
      at(DAY_MS + 33_000),
    );

    expect(ended.spent.queuedMs).toBe(5_000);
    expect(ended.spent.runningMs).toBe(90_000);
    expect(ended.spent.firstStartedAt).toEqual(at(2_000));
    expect(ended.startedAt).toEqual(at(DAY_MS + 3_000));
  });

  it('keeps the work of an attempt whose runner was lost, and queues it again', () => {
    const started = startedAt(queued(), 1_000, 2_000);
    const lost = started.expireLease(leaseEndOf(started));

    expect(lost.spent.runningMs).toBe(
      leaseEndOf(started).getTime() - at(2_000).getTime(),
    );
    expect(lost.queuedAt).toEqual(started.leaseExpiresAt);
  });

  it('counts only the queue of a run that never started', () => {
    const { run } = queued().cancel('Not needed.', at(4_000));

    expect(run.spent.queuedMs).toBe(4_000);
    expect(run.spent.runningMs).toBe(0);
    expect(run.spent.firstStartedAt).toBeNull();
  });

  it('does not count a start again when the runner reports the same image twice', () => {
    const started = startedAt(queued(), 1_000, 2_000);

    expect(started.startedIn(RUNNER, IMAGE, at(9_000)).spent.queuedMs).toBe(
      2_000,
    );
  });

  it('reads back as stored', () => {
    expect(() =>
      TimeSpent.rehydrate({
        queuedMs: -1,
        runningMs: 0,
        firstStartedAt: null,
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      TimeSpent.rehydrate({ queuedMs: 0, runningMs: 5, firstStartedAt: null }),
    ).toThrow(InconsistentStateError);
  });

  it('reads back only a start that its spent time knows of', () => {
    const run = firstTurn();
    const stored = {
      ...run,
      ...run.ordered,
      attempt: run.attempt.number,
      suspendedAttempts: run.suspendedAttempts.map((each) => each.number),
    };

    expect(() => Run.rehydrate(stored)).not.toThrow();
    expect(() => Run.rehydrate({ ...stored, spent: TimeSpent.none() })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      Run.rehydrate({
        ...stored,
        spent: TimeSpent.rehydrate({
          queuedMs: 0,
          runningMs: 0,
          firstStartedAt: at(DAY_MS),
        }),
      }),
    ).toThrow(InconsistentStateError);
  });
});
