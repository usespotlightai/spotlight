import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run, type RunStart } from '@work/domain/aggregates/run.aggregate';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);

const RUNNER = RunnerId.of('runner_1');
const OTHER = RunnerId.of('runner_2');

const API = 'a'.repeat(40);
const WEB = 'b'.repeat(40);

const ofTask = RunSubject.task(
  TaskId.of('task_1'),
  StationId.of('station_1'),
  TaskRevision.of(1),
);

const queued = (subject: RunSubject | null = ofTask) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject,
    spec: RunSpec.of({
      checkouts: [
        { remote: 'spotlight:repository', path: 'web' },
        { remote: 'spotlight:repository', path: 'api' },
      ],
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task-task_1' },
    }),
  });

const claimed = (subject?: RunSubject | null) =>
  queued(subject).claim(RUNNER, NOW);

const on = (attempt = 1) => RunAttempt.of(RunId.of('run_1'), attempt);

const archiveOf = (
  id: string,
  workspace = 'ws_1',
  continuity = ContinuityKey.forTask('task_1'),
) =>
  RestoredArchive.of(
    WorkspaceArchiveId.of(id),
    WorkspaceId.of(workspace),
    continuity,
  );

const restored = (
  archive: RestoredArchive | null = archiveOf('archive_1'),
  api = API,
): RunStart => ({
  restored: archive,
  checkouts: [
    StartedCheckout.of({ path: 'api', commit: api }),
    StartedCheckout.of({ path: 'web', commit: WEB }),
  ],
});

describe('where a run started', () => {
  it('records the archive it restored and the commit each checkout began at', () => {
    const run = claimed().startsFrom(on(), RUNNER, restored(), NOW);

    expect(run.startedFrom?.archive?.value).toBe('archive_1');
    expect(run.startedFrom?.parts.checkouts).toEqual([
      { path: 'api', commit: API },
      { path: 'web', commit: WEB },
    ]);
    expect(run.startedFrom?.attempt).toBe(1);
    expect(run.startedFrom?.at).toEqual(NOW);
  });

  it('records a first run, which restored nothing, as starting afresh', () => {
    const run = claimed().startsFrom(on(), RUNNER, restored(null), NOW);

    expect(run.startedFrom?.archive).toBeNull();
  });

  it('rejects an archive of another workspace or another piece of work', () => {
    for (const elsewhere of [
      archiveOf('archive_1', 'ws_2'),
      archiveOf('archive_1', 'ws_1', ContinuityKey.forTask('task_2')),
    ]) {
      expect(() =>
        claimed().startsFrom(on(), RUNNER, restored(elsewhere), NOW),
      ).toThrow(InvalidStartingPointError);
    }
  });

  it('takes the same report again as it was', () => {
    const first = claimed().startsFrom(on(), RUNNER, restored(), NOW);
    const again = first.startsFrom(on(), RUNNER, restored(), later(1_000));

    expect(again).toBe(first);
    expect(again.startedFrom?.at).toEqual(NOW);
  });

  it('rejects a second report that says it started somewhere else', () => {
    const first = claimed().startsFrom(on(), RUNNER, restored(), NOW);

    expect(() =>
      first.startsFrom(on(), RUNNER, restored(archiveOf('archive_2')), NOW),
    ).toThrow(InvalidRunTransitionError);
    expect(() =>
      first.startsFrom(
        on(),
        RUNNER,
        restored(archiveOf('archive_1'), 'c'.repeat(40)),
        NOW,
      ),
    ).toThrow(InvalidRunTransitionError);
  });

  it('keeps where its first attempt started when a later attempt starts elsewhere', () => {
    const first = claimed().startsFrom(on(), RUNNER, restored(), NOW);
    const lapsed = first.requeue(first.leaseExpiresAt as Date);
    const retried = lapsed
      .claim(OTHER, later(120_000))
      .startsFrom(
        on(2),
        OTHER,
        restored(archiveOf('archive_2')),
        later(120_000),
      );

    expect(retried.attempt).toBe(2);
    expect(retried.startedFrom?.archive?.value).toBe('archive_1');
    expect(retried.startedFrom?.attempt).toBe(1);
  });

  it('rejects a report from an attempt that is over', () => {
    const lapsed = claimed().requeue(later(60_000));
    const retried = lapsed.claim(RUNNER, later(120_000));

    expect(() =>
      retried.startsFrom(on(1), RUNNER, restored(), later(120_000)),
    ).toThrow(RunAttemptOverError);
  });

  it('is recorded only by the runner working it', () => {
    expect(() => claimed().startsFrom(on(), OTHER, restored(), NOW)).toThrow(
      RunAttemptOverError,
    );
    expect(() => queued().startsFrom(on(), RUNNER, restored(), NOW)).toThrow(
      RunAttemptOverError,
    );
  });

  it('is recorded only for a run that works a task', () => {
    expect(() =>
      claimed(RunSubject.chat(ChatId.of('chat_1'))).startsFrom(
        on(),
        RUNNER,
        restored(null),
        NOW,
      ),
    ).toThrow(InvalidRunTransitionError);
    expect(() =>
      claimed(null).startsFrom(on(), RUNNER, restored(null), NOW),
    ).toThrow(InvalidRunTransitionError);
  });

  it('names exactly the checkouts the run was given', () => {
    const missing: RunStart = {
      restored: null,
      checkouts: [StartedCheckout.of({ path: 'api', commit: API })],
    };
    const extra: RunStart = {
      restored: null,
      checkouts: [
        ...restored(null).checkouts,
        StartedCheckout.of({ path: 'docs', commit: WEB }),
      ],
    };

    expect(() => claimed().startsFrom(on(), RUNNER, missing, NOW)).toThrow(
      InvalidStartingPointError,
    );
    expect(() => claimed().startsFrom(on(), RUNNER, extra, NOW)).toThrow(
      InvalidStartingPointError,
    );
  });

  describe('rehydrated', () => {
    const rehydrated = (
      subject: RunSubject | null,
      startedFrom: StartingPoint,
    ) => {
      const run = queued();

      return Run.rehydrate({
        id: run.id,
        workspaceId: run.workspaceId,
        harness: run.harness,
        priority: run.priority,
        subject,
        spec: run.spec,
        state: 'queued',
        claimedBy: null,
        leaseExpiresAt: null,
        outcome: null,
        attempt: 1,
        reservation: null,
        provisioning: run.provisioning,
        startedFrom,
      });
    };

    const point = (attempt: number) =>
      StartingPoint.rehydrate({
        archive: null,
        checkouts: [],
        attempt,
        at: NOW,
      });

    it('cannot have started on an attempt it has not made', () => {
      expect(() => rehydrated(ofTask, point(2))).toThrow(
        InconsistentStateError,
      );
    });

    it('cannot have started from somewhere when it works no task', () => {
      expect(() =>
        rehydrated(RunSubject.chat(ChatId.of('chat_1')), point(1)),
      ).toThrow(InconsistentStateError);
    });
  });
});
