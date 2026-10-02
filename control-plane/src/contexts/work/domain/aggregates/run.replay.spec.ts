import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunBriefed } from '@work/domain/events/run-briefed.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { KeptFromReplaysError } from '@work/domain/exceptions/kept-from-replays.error';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import {
  RunSpec,
  type RunSpecParts,
} from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');
const COMMIT = 'a'.repeat(40);

const REPLAY = RunSubject.replay(
  RunId.of('run_0'),
  TaskId.of('task_1'),
  StationId.of('station_1'),
  TeamId.of('team_1'),
);

const OF_TASK = RunSubject.task(
  TaskId.of('task_1'),
  StationId.of('station_1'),
  TaskRevision.of(1),
);

const TASK_SPEC: RunSpecParts = {
  checkouts: [{ remote: 'spotlight:repository', path: 'api' }],
  command: { executable: 'sh', args: [] },
  briefing: 'Fix the queue.',
  handover: { options: ['review'], noteLimit: 0 },
  continuity: { key: 'task-task_1' },
};

const REPLAY_SPEC: RunSpecParts = {
  ...TASK_SPEC,
  checkouts: [{ remote: 'spotlight:repository', path: 'api', ref: COMMIT }],
  continuity: { key: 'replay-run_1' },
  replay: {
    archive: 'archive_1',
    checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
    movesOnAfter: ['build', 'done'],
  },
};

const MEMORIES = BriefedMemories.of({
  briefed: [{ id: 'memory_1', handle: 'M-1' }],
  cut: [],
});

const queued = (
  subject: RunSubject | null = REPLAY,
  spec: RunSpecParts = REPLAY_SPEC,
) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.of(-1),
    subject,
    spec: RunSpec.of(spec),
    briefedWith: MEMORIES,
  });

const claimed = () => queued().claim(RUNNER, NOW);

const finished = RunOutcome.of({ exitCode: 0, failed: false });

const saying = (next: string) =>
  HandoverReport.of({ declared: Declaration.of({ next }), session: null });

describe('a replay', () => {
  it('works no task of its own and keeps no workspace for one', () => {
    const run = queued();

    expect(run.isReplay).toBe(true);
    expect(run.replayOf?.value).toBe('run_0');
    expect(run.taskId).toBeNull();
    expect(run.archiveHolder).toBeNull();
    expect(run.restoresFrom).toBeNull();
    expect(run.restoresArchive?.value).toBe('archive_1');
  });

  it('is replayed only from a spec that says what it replays, and the other way round', () => {
    expect(() => queued(REPLAY, TASK_SPEC)).toThrow(InvalidRunTransitionError);
    expect(() => queued(OF_TASK, REPLAY_SPEC)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('says nothing of the memories it was briefed with, which are the ones its original was', () => {
    const run = queued();

    expect(run.briefedWith.equals(MEMORIES)).toBe(true);
    expect(run.pullEvents().some((each) => each instanceof RunBriefed)).toBe(
      false,
    );
  });

  it('never says where it started, as only a task run does', () => {
    expect(() =>
      claimed().startsFrom(
        claimed().currentAttempt,
        RUNNER,
        {
          restored: null,
          checkouts: [StartedCheckout.of({ path: 'api', commit: COMMIT })],
        },
        NOW,
      ),
    ).toThrow(InvalidRunTransitionError);
  });

  it('never waits for a person', () => {
    expect(() =>
      claimed().paused(RUNNER, finished, saying('review'), NOW),
    ).toThrow(InvalidRunTransitionError);
  });

  it('ends recording that it asked a person, when its runner says so', () => {
    const ended = claimed()
      .askedAPersonBy(RUNNER)
      .complete(RUNNER, finished, saying('build'));
    const [completed] = ended
      .pullEvents()
      .filter((each): each is RunCompleted => each instanceof RunCompleted);

    expect(ended.hasCompleted).toBe(true);
    expect(ended.askedAPerson).toBe(true);
    expect(completed?.asked).toBe(true);
  });

  it('ends recording that it asked a person, when its handover would have put the work to one under the candidate', () => {
    for (const next of ['review', 'Nowhere', '']) {
      expect(
        claimed().complete(RUNNER, finished, saying(next)).askedAPerson,
      ).toBe(true);
    }
    expect(
      claimed().complete(
        RUNNER,
        finished,
        HandoverReport.of({ declared: null, session: null }),
      ).askedAPerson,
    ).toBe(true);
  });

  it('ends recording that it asked nobody where it failed, was stopped, or moved on as the candidate would', () => {
    expect(
      claimed().complete(RUNNER, RunOutcome.stopped(130), saying('review'))
        .askedAPerson,
    ).toBe(false);
    expect(
      claimed().complete(RUNNER, finished, saying('Done')).askedAPerson,
    ).toBe(false);
  });

  it('gives up rather than going back on the queue once it has asked a person', () => {
    const asked = claimed().askedAPersonBy(RUNNER);
    const lapsed = asked.requeue(new Date(NOW.getTime() + 120_000));
    const [abandoned] = lapsed
      .pullEvents()
      .filter((each): each is RunAbandoned => each instanceof RunAbandoned);

    expect(lapsed.hasEnded).toBe(true);
    expect(abandoned?.asked).toBe(true);
    expect(claimed().requeue(new Date(NOW.getTime() + 120_000)).state).toBe(
      'queued',
    );
  });

  it('checks out only the repositories it replays', () => {
    expect(claimed().replayedRepository('api')?.value).toBe('acme/api');
    expect(claimed().replayedRepository('web')).toBeNull();
  });

  it('reaches nothing beyond itself, and hears no hook', () => {
    expect(() => claimed().mayReachBeyondItself('answer a remark')).toThrow(
      KeptFromReplaysError,
    );
    expect(claimed().hearsHooks).toBe(false);
    expect(queued(OF_TASK, TASK_SPEC).hearsHooks).toBe(true);
  });

  it('ends recording that it asked nobody, when it did not', () => {
    const ended = claimed().complete(RUNNER, finished, saying('build'));
    const [completed] = ended
      .pullEvents()
      .filter((each): each is RunCompleted => each instanceof RunCompleted);

    expect(ended.askedAPerson).toBe(false);
    expect(completed?.asked).toBe(false);
  });

  it('asks nobody of itself while it is no replay', () => {
    const ofTask = queued(OF_TASK, TASK_SPEC).claim(RUNNER, NOW);

    expect(() => ofTask.askedAPersonBy(RUNNER)).toThrow(
      InvalidRunTransitionError,
    );
    expect(
      ofTask.complete(RUNNER, finished, saying('review')).askedAPerson,
    ).toBe(false);
  });

  it('comes back only as a replay with a replay’s spec, and asked a person only if it is one', () => {
    const stored = {
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      harness: HarnessId.of('dev'),
      priority: RunPriority.normal,
      state: 'queued' as const,
      claimedBy: null,
      leaseExpiresAt: null,
      outcome: null,
      attempt: 1,
      reservation: null,
      provisioning: Provisioning.none(),
    };

    expect(() =>
      Run.rehydrate({
        ...stored,
        subject: REPLAY,
        spec: RunSpec.of(TASK_SPEC),
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      Run.rehydrate({
        ...stored,
        subject: OF_TASK,
        spec: RunSpec.of(TASK_SPEC),
        askedAPerson: true,
      }),
    ).toThrow(InconsistentStateError);
    expect(
      Run.rehydrate({
        ...stored,
        subject: REPLAY,
        spec: RunSpec.of(REPLAY_SPEC),
        askedAPerson: true,
      }).askedAPerson,
    ).toBe(true);
  });
});
