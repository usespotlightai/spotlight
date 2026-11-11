import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { InvalidHookFiringTransitionError } from '@integrations/domain/exceptions/invalid-hook-firing-transition.error';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  pullRequestMerged,
  runEnded,
  taskMoved,
  usedTool,
} from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookMatch } from '@integrations/domain/value-objects/hook-match.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { Hook } from '@integrations/domain/value-objects/hook.vo';
import { RunAttemptRef } from '@integrations/domain/value-objects/run-attempt-ref.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const later = (ms: number) => new Date(NOW.getTime() + ms);

const MOVED = {
  kind: 'event' as const,
  key: 'task.moved:task_1:triage → build',
  description: 'task.moved of Add a column (triage → build)',
};

const AUDIT = {
  kind: 'hook' as const,
  key: `hook:audit_id:${MOVED.key}`,
  description: 'the hook audit',
};

const LOOP = HookFailure.of('loop', 'The hook audit was stopped: again');

const fired = (cause = CausalChain.none().append(MOVED)) =>
  HookFiring.fire({
    id: HookFiringId.of('firing_1'),
    hookId: HookDefinitionId.of('audit_id'),
    workspaceId: WorkspaceId.of('workspace_1'),
    teamId: TeamId.of('team_1'),
    taskId: TaskId.of('task_1'),
    run: RunAttemptRef.of(RunId.of('run_1'), 1),
    stationKey: StationKey.of('implementation'),
    on: 'task.moved',
    occurrence: HookOccurrenceKey.of('moved_1'),
    firedAt: NOW,
    event: taskMoved('triage', 'build'),
    matched: true,
    cause,
    link: AUDIT,
  });

const merging = () =>
  HookFiring.fire({
    ...stateOf(fired()),
    on: 'pull-request.merged',
    event: pullRequestMerged('acme/api'),
  });

const stateOf = (firing: HookFiring) => ({
  id: firing.id,
  hookId: firing.hookId,
  workspaceId: firing.workspaceId,
  teamId: firing.teamId,
  taskId: firing.taskId,
  run: firing.run,
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

const stored = (firing: HookFiring, version = 1) =>
  HookFiring.rehydrate({ ...stateOf(firing), version });

const working = (firing = fired()) => stored(firing).claimed(NOW);

const DONE_A = {
  name: HookStepName.of('a'),
  status: 'done' as const,
  output: null,
};

const DONE_B = {
  name: HookStepName.of('b'),
  status: 'done' as const,
  output: null,
};

const FAILED_B = {
  name: HookStepName.of('b'),
  status: 'failed' as const,
  code: 'rejected' as const,
  reason: 'was answered 400',
  output: null,
};

const WAITING_B = {
  name: HookStepName.of('b'),
  status: 'waiting' as const,
  call: 'call_1',
  until: later(60_000),
};

const HOOK = Hook.of({
  key: HookKey.of('audit'),
  event: HookEvent.of('task.moved'),
  match: HookMatch.anything(HookEvent.of('task.moved')),
  steps: ['a', 'b', 'c'].map((name) => ({
    name: HookStepName.of(name),
    kind: 'call' as const,
    tool: ToolName.of('linear.comment'),
  })),
  signing: null,
  failure: 'continue',
  timeoutSeconds: 10,
});

describe('HookFiring', () => {
  it('waits to be worked from the moment it fired', () => {
    const firing = fired();

    expect(firing.progress).toEqual({ kind: 'pending', dueAt: NOW });
    expect(firing.attempts).toBe(0);
    expect(firing.isNew).toBe(true);
  });

  it('keeps its own frozen copy of the event it fired on', () => {
    const inputs = { marks: ['db'] };
    const firing = HookFiring.fire({
      ...stateOf(fired()),
      on: 'tool.used',
      event: usedTool('linear.comment', { inputs }),
    });

    inputs.marks.push('api');

    expect(firing.event.fields).toMatchObject({ inputs: { marks: ['db'] } });
    expect(
      Object.isFrozen(
        (firing.event.fields as unknown as { inputs: { marks: string[] } })
          .inputs.marks,
      ),
    ).toBe(true);
  });

  it('refuses to fire on one event with the facts of another', () => {
    expect(() =>
      HookFiring.fire({ ...stateOf(fired()), on: 'run.ended' }),
    ).toThrow(InvalidHookFiringTransitionError);
  });

  describe('being claimed', () => {
    it('is claimed once it is due', () => {
      expect(working().progress).toEqual({ kind: 'working', claimedAt: NOW });
    });

    it('is not claimed before it is due', () => {
      const waiting = stored(
        working().stepTaken(
          HOOK,
          { ...WAITING_B, name: HookStepName.of('a') },
          NOW,
        ),
      );

      expect(() => waiting.claimed(later(1_000))).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(waiting.claimed(later(2_000)).progress.kind).toBe('working');
    });

    it('is not claimed from a worker that still has the lease, only once its lease expires', () => {
      const leased = stored(working());

      expect(() => leased.claimed(later(10 * 60_000))).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(leased.claimed(later(10 * 60_000 + 1)).progress).toEqual({
        kind: 'working',
        claimedAt: later(10 * 60_000 + 1),
      });
    });

    it('is never claimed once finished', () => {
      const done = stored(working().worked(NOW));

      expect(() => done.claimed(later(60 * 60_000))).toThrow(
        InvalidHookFiringTransitionError,
      );
    });
  });

  describe('while a worker has the lease', () => {
    it('keeps the steps it has taken', () => {
      expect(working().stepTaken(HOOK, DONE_A, NOW).steps).toEqual([DONE_A]);
    });

    it('takes the steps of its hook in order, never one done', () => {
      const firing = working();

      expect(firing.nextStepOf(HOOK)).toEqual({
        name: HookStepName.of('a'),
        earlier: [],
        resuming: null,
      });

      const halfway = firing.stepTaken(HOOK, DONE_A, NOW);

      expect(halfway.nextStepOf(HOOK)).toEqual({
        name: HookStepName.of('b'),
        earlier: [DONE_A],
        resuming: null,
      });
      expect(() => halfway.stepTaken(HOOK, DONE_A, NOW)).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(() =>
        halfway.stepTaken(HOOK, { ...DONE_B, name: HookStepName.of('c') }, NOW),
      ).toThrow(InvalidHookFiringTransitionError);
      expect(
        halfway
          .stepTaken(HOOK, DONE_B, NOW)
          .stepTaken(HOOK, { ...DONE_B, name: HookStepName.of('c') }, NOW)
          .nextStepOf(HOOK),
      ).toBeNull();
    });

    it('takes a failed step again on its next attempt, and nothing after it', () => {
      const failed = working()
        .stepTaken(HOOK, DONE_A, NOW)
        .stepTaken(HOOK, FAILED_B, NOW);

      expect(failed.steps).toEqual([DONE_A, FAILED_B]);
      expect(failed.nextStepOf(HOOK)?.name.value).toBe('b');
      expect(failed.stepTaken(HOOK, DONE_B, NOW).steps).toEqual([
        DONE_A,
        DONE_B,
      ]);
    });

    it('waits on one call at its last step, and resumes that call', () => {
      const waiting = working()
        .stepTaken(HOOK, DONE_A, NOW)
        .stepTaken(HOOK, WAITING_B, NOW);

      expect(waiting.progress).toEqual({
        kind: 'pending',
        dueAt: later(2_000),
      });
      expect(waiting.attempts).toBe(0);

      const resumed = stored(waiting).claimed(later(2_000));

      expect(resumed.nextStepOf(HOOK)).toEqual({
        name: HookStepName.of('b'),
        earlier: [DONE_A],
        resuming: WAITING_B,
      });
      expect(() =>
        resumed.stepTaken(HOOK, { ...WAITING_B, call: 'call_2' }, NOW),
      ).toThrow(InvalidHookFiringTransitionError);
      expect(resumed.stepTaken(HOOK, DONE_B, NOW).steps).toEqual([
        DONE_A,
        DONE_B,
      ]);
    });

    it('cannot be stored with an impossible trail of steps', () => {
      expect(() =>
        HookFiring.rehydrate({
          ...stateOf(fired()),
          steps: [FAILED_B, DONE_A],
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
      expect(() =>
        HookFiring.rehydrate({
          ...stateOf(fired()),
          steps: [DONE_A, DONE_A],
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
    });

    it('is matched once, with what it learned about the event', () => {
      const unmatched = HookFiring.rehydrate({
        ...stateOf(merging()),
        matched: false,
        version: 1,
      }).claimed(NOW);
      const learned = pullRequestMerged('acme/api', ['db/1.sql']);
      const matched = unmatched.recordMatch(learned);

      expect(matched.matched).toBe(true);
      expect(matched.event).toEqual(learned);
      expect(() => matched.recordMatch(learned)).toThrow(
        InvalidHookFiringTransitionError,
      );
    });

    it('keeps its own frozen copy of the event it matched', () => {
      const changed = ['db/1.sql'];
      const matched = HookFiring.rehydrate({
        ...stateOf(merging()),
        matched: false,
        version: 1,
      })
        .claimed(NOW)
        .recordMatch(pullRequestMerged('acme/api', changed));

      changed.push('db/2.sql');

      expect(matched.event.changed).toEqual(['db/1.sql']);
      expect(Object.isFrozen(matched.event.changed)).toBe(true);
    });

    it('refuses the facts of another event as its match', () => {
      const unmatched = HookFiring.rehydrate({
        ...stateOf(fired()),
        matched: false,
        version: 1,
      }).claimed(NOW);

      expect(() => unmatched.recordMatch(runEnded())).toThrow(
        InvalidHookFiringTransitionError,
      );
    });

    it('is worked, spending an attempt', () => {
      const done = working().worked(later(1_000));

      expect(done.progress).toEqual({ kind: 'done', at: later(1_000) });
      expect(done.attempts).toBe(1);
      expect(done.finished).toBe(true);
    });

    it('rejects every change unless a worker has the lease', () => {
      const pending = stored(fired());

      expect(() => pending.stepTaken(HOOK, DONE_A, NOW)).toThrow(
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
    it('is retried later after a failure that allows a retry', () => {
      const failed = working().failedWith(
        HookFailure.of('server-error', 'was answered 503'),
        NOW,
        false,
      );

      expect(failed.progress).toEqual({ kind: 'pending', dueAt: later(2_000) });
      expect(failed.attempts).toBe(1);
      expect(failed.failure?.code).toBe('server-error');
      expect(failed.willRetry(HookFailure.of('server-error', 'x'), NOW)).toBe(
        true,
      );
    });

    it('ends failed after its last attempt', () => {
      let firing = working();

      for (let attempt = 0; attempt < 7; attempt += 1) {
        firing = stored(
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
    const looped = CausalChain.none().append(MOVED).append(AUDIT).append(MOVED);

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
        working(fired(looped))
          .stepTaken(HOOK, DONE_A, NOW)
          .loopStop('audit', 9),
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

    it('ends as a loop once notified, or superseded when nobody is there to notify', () => {
      const stopped = working().stopForLoop(LOOP);

      expect(stopped.markLoopNotified(NOW, false).failure).toBe(LOOP);
      expect(stopped.markLoopNotified(NOW, false).progress.kind).toBe('failed');
      expect(stopped.markLoopNotified(NOW, true).progress.kind).toBe(
        'superseded',
      );
    });

    it('is not marked as notified of a loop before it is stopped for one', () => {
      expect(() => working().markLoopNotified(NOW, false)).toThrow(
        InvalidHookFiringTransitionError,
      );
    });

    it('keeps its stop to notify again when something fails before the notice', () => {
      const stopped = working().stopForLoop(LOOP);
      const again = stopped.failedWith(
        HookFailure.of('unavailable', 'db went away'),
        NOW,
        true,
      );

      expect(again.progress).toEqual({ kind: 'pending', dueAt: later(2_000) });
      expect(again.failure).toBe(LOOP);
    });

    it('ends as a loop when it could never be notified', () => {
      const stopped = HookFiring.rehydrate({
        ...stateOf(working().stopForLoop(LOOP)),
        attempts: 7,
        version: 1,
      });

      expect(
        stopped.failedWith(HookFailure.of('unavailable', 'x'), NOW, true)
          .failure,
      ).toBe(LOOP);
    });

    it('lets a failure that may never be retried end a stop still to be notified', () => {
      const stopped = working().stopForLoop(LOOP);

      expect(
        stopped.failedWith(HookFailure.of('broken', 'unreadable'), NOW, false)
          .failure?.code,
      ).toBe('broken');
    });
  });

  describe('being purged', () => {
    it('is purged thirty days after it finishes', () => {
      const done = stored(working().worked(NOW));
      const month = later(30 * 24 * 60 * 60_000);

      expect(done.isPastRetention(later(1))).toBe(false);
      expect(() => done.purge(later(1))).toThrow(
        InvalidHookFiringTransitionError,
      );
      expect(done.purge(month).isDiscarded).toBe(true);
      expect(HookFiring.retentionCutoff(month)).toEqual(NOW);
    });

    it('is never purged while it is pending', () => {
      expect(
        stored(fired()).isPastRetention(later(365 * 24 * 60 * 60_000)),
      ).toBe(false);
    });
  });

  describe('as stored', () => {
    it('rejects a firing stored without a version', () => {
      expect(() => stored(fired(), 0)).toThrow(InconsistentStateError);
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

  it('ends when its hook broke or its task is gone, saying why', () => {
    const broken = working().hookBroken('audit', 'unreadable', NOW);
    const gone = working().taskGone(NOW);

    expect(broken.failure?.code).toBe('broken');
    expect(broken.failure?.reason).toBe(
      'Hook audit is broken. Reason: unreadable',
    );
    expect(gone.progress).toEqual({ kind: 'superseded', at: NOW });
    expect(gone.failure?.code).toBe('superseded');
  });

  describe('reading what a merged pull request changed', () => {
    const merged = (matched: boolean) =>
      HookFiring.fire({
        ...stateOf(fired()),
        on: 'pull-request.merged',
        event: pullRequestMerged('acme/api'),
        matched,
      });

    it('reads the changes of a merged pull request it matches only later', () => {
      const changes = merged(false).changesToRead;

      expect(changes?.repository).toEqual(Repository.of('acme/api'));
      expect(changes?.pullRequest).toEqual(
        PullRequestUrl.of('https://github.com/acme/api/pull/7'),
      );
    });

    it('reads nothing once it is matched, or for another event', () => {
      expect(merged(true).changesToRead).toBeNull();
      expect(fired().changesToRead).toBeNull();
    });

    it('hands over its event with what changed', () => {
      expect(merged(false).eventWithChanges(['db/1.sql'])).toEqual(
        pullRequestMerged('acme/api', ['db/1.sql']),
      );
    });
  });

  it('counts its repeats by its hook, task and link', () => {
    expect(fired().repeatsOf).toEqual({
      hookId: HookDefinitionId.of('audit_id'),
      taskId: TaskId.of('task_1'),
      link: AUDIT,
      since: new Date(NOW.getTime() - 10 * 60 * 1000),
      before: { firedAt: NOW, id: HookFiringId.of('firing_1') },
    });
  });
});
