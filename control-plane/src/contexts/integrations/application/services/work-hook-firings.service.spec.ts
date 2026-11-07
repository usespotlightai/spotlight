import { causationInMemory } from '@integrations/application/ports/causation.fake-spec';
import type {
  ListeningHook,
  StepRequest,
  StepResult,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  HookTaskNotesPort,
  LoopNotice,
  LoopNoticeReport,
} from '@integrations/application/ports/hook-task-notes.port';
import type {
  LinkedTaskView,
  TasksForHooksPort,
} from '@integrations/application/ports/tasks-for-hooks.port';
import {
  clock,
  done,
  EVENT,
  failed,
  firingsInMemory,
  hookNamed,
  later,
  logger,
  NOW,
  runtimeOf,
  stateOf,
  stepsOf,
  TASK,
} from '@integrations/application/services/hook-firings.fake-spec';
import { WorkHookFirings } from '@integrations/application/services/work-hook-firings.service';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { pullRequestMerged } from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import {
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { HookRunAttempt } from '@integrations/domain/value-objects/hook-run-attempt.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  HookFailureNotice,
  HookFailureReport,
  TaskNotesFromHooksPort,
} from '@work/application/ports/task-notes-from-hooks.port';
import { describe, expect, it, vi } from 'vitest';

const setUp = (
  hooks: ListeningHook[],
  step: (request: StepRequest) => StepResult,
  {
    whenHolds = () => true,
    stored = null,
    task = TASK,
    repeats = 0,
    notice = 'reported',
    movedOn = false,
  }: {
    whenHolds?: () => boolean;
    stored?: HookFiring | null;
    task?: LinkedTaskView | null;
    repeats?: number;
    notice?: HookFailureNotice;
    movedOn?: boolean;
  } = {},
) => {
  const telemetry = telemetryInMemory();
  const runtime = runtimeOf(hooks, whenHolds);
  const steps = stepsOf(step);
  const inMemory = firingsInMemory(stored);
  const history = {
    recentRepeats: vi.fn(async () => repeats),
    chainOf: vi.fn(async () => null),
  };
  const tasks = {
    of: vi.fn(async () => task),
    ofPullRequest: vi.fn(async () => task),
  } satisfies TasksForHooksPort;
  const notes = {
    noted: vi.fn(async () => true),
    failed: vi.fn(async (_report: HookFailureReport) => notice),
    movedOn: vi.fn(async (_taskId: string, _stationKey: string) => movedOn),
  } satisfies TaskNotesFromHooksPort;
  const taskNotes = {
    loopNotice: async (report: LoopNoticeReport): Promise<LoopNotice> => {
      try {
        return {
          kind: 'sent',
          onTask: await notes.failed({
            taskId: report.taskId.value,
            stationKey: report.stationKey.value,
            hook: report.hook.value,
            code: report.loop.code,
            reason: report.loop.reason,
            receivedAs: report.receivedAs,
          }),
        };
      } catch (error) {
        return {
          kind: 'failed',
          failure: HookFailure.unavailable(String(error)),
        };
      }
    },
    movedOn: (taskId: TaskId, stationKey: StationKey) =>
      notes.movedOn(taskId.value, stationKey.value),
  } satisfies HookTaskNotesPort;
  const causation = causationInMemory();
  const changedIn = vi.fn(async () => ['db/migrations/1.sql']);

  return {
    runtime,
    ...inMemory,
    take: steps.take,
    notes,
    tasks,
    changedIn,
    causation,
    telemetry,
    hooked: new WorkHookFirings(
      runtime,
      steps.steps,
      inMemory.firings,
      history,
      tasks,
      taskNotes,
      {
        open: vi.fn(),
        edit: vi.fn(),
        statusOf: vi.fn(),
        close: vi.fn(),
        comment: vi.fn(),
        changedOn: vi.fn(),
        changedIn,
      },
      clock,
      causation,
      logger(),
      telemetry,
    ),
  };
};

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

const stored = (
  overrides: Partial<ReturnType<typeof stateOf>> = {},
): HookFiring =>
  HookFiring.rehydrate({
    ...stateOf(
      HookFiring.fire({
        id: HookFiringId.of('firing_1'),
        hookId: HookDefinitionId.of('audit_id'),
        workspaceId: WorkspaceId.of('workspace_1'),
        teamId: TeamId.of('team_1'),
        taskId: TaskId.of('task_1'),
        run: HookRunAttempt.of(RunId.of('run_1'), 1),
        stationKey: StationKey.of('implementation'),
        on: 'tool.used',
        occurrence: HookOccurrenceKey.of('occurrence_1'),
        firedAt: NOW,
        event: EVENT,
        matched: true,
        cause: CausalChain.none().append(MOVED),
        link: AUDIT,
      }),
    ),
    version: 1,
    ...overrides,
  });

const MERGED = {
  hookId: HookDefinitionId.of('dba_id'),
  on: 'pull-request.merged' as const,
  matched: false,
  event: pullRequestMerged('acme/api'),
};

describe('WorkHookFirings.workOne', () => {
  it('delivers every step and marks the firing worked', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (request) => done(request.step),
      { stored: stored() },
    );

    await expect(hooked.workOne()).resolves.toBe(true);
    expect(last()?.progress).toEqual({ kind: 'done', at: NOW });
    expect(last()?.steps).toEqual([
      expect.objectContaining({ name: HookStepName.of('a'), status: 'done' }),
      expect.objectContaining({ name: HookStepName.of('b'), status: 'done' }),
    ]);
  });

  it('has nothing to do when no firing is due', async () => {
    const { hooked } = setUp([hookNamed('audit', ['a'])], () => done('a'));

    await expect(hooked.workOne()).resolves.toBe(false);
  });

  it('retries from the failed step, keeping the steps already done', async () => {
    const requested: number[] = [];
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (each) => {
        requested.push(each.earlier.length);
        return failed('b');
      },
      {
        stored: stored({
          steps: [{ name: HookStepName.of('a'), status: 'done', output: null }],
          attempts: 1,
        }),
      },
    );

    await hooked.workOne();

    expect(requested).toEqual([1]);
    expect(last()?.progress).toEqual({ kind: 'pending', dueAt: later(4_000) });
    expect(last()?.failure).toEqual(
      HookFailure.of(
        'server-error',
        'Hook audit failed at step b. Reason: was answered 503',
      ),
    );
  });

  it('fails the firing after the last attempt', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => failed('a'),
      { stored: stored({ attempts: 7 }) },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure?.code).toBe('server-error');
  });

  it.each<HookFailureCode>(['tool-failed', 'errored', 'unwritable'])(
    'fails the firing at once on a step that failed as %s',
    async (code) => {
      const { hooked, last } = setUp(
        [hookNamed('audit', ['a'])],
        () => failed('a', 'went wrong', code),
        { stored: stored() },
      );

      await hooked.workOne();

      expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
      expect(last()?.failure?.code).toBe(code);
    },
  );

  it('ends a firing at once when Spotlight itself fails taking a step', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => {
        throw new Error('a bug');
      },
      { stored: stored() },
    );

    await expect(hooked.workOne()).resolves.toBe(true);

    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure).toEqual(HookFailure.errored('a bug'));
  });

  it('fails the firing at once on a failure that allows no retry', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => failed('a', 'was answered 404', 'rejected'),
      { stored: stored() },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure?.code).toBe('rejected');
  });

  it('supersedes a failure on a task that has moved on from where it fired', async () => {
    const { hooked, last, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => failed('a', 'was answered 404', 'rejected'),
      { stored: stored(), movedOn: true },
    );

    await hooked.workOne();

    expect(notes.movedOn).toHaveBeenCalledWith('task_1', 'implementation');
    expect(last()?.progress).toEqual({ kind: 'superseded', at: NOW });
  });

  it('requests nothing about the task while the firing waits for a retry', async () => {
    const { hooked, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => failed('a'),
      { stored: stored(), movedOn: true },
    );

    await hooked.workOne();

    expect(notes.movedOn).not.toHaveBeenCalled();
  });

  it('supersedes a firing whose task is gone, telling nobody', async () => {
    const { hooked, last, take } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored(), task: null },
    );

    await hooked.workOne();

    expect(take).not.toHaveBeenCalled();
    expect(last()?.progress).toEqual({ kind: 'superseded', at: NOW });
  });

  it('ends a firing whose hook no longer reads as it was written', async () => {
    const { hooked, last } = setUp(
      [
        {
          ...hookNamed('audit', ['a']),
          broken: 'when is gone',
          written: null,
        },
      ],
      () => done('a'),
      { stored: stored() },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure?.code).toBe('broken');
  });

  it('delivers its steps in the chain of causes it fired in, followed by itself', async () => {
    const chains: string[] = [];
    const { hooked, causation } = setUp(
      [hookNamed('audit', ['a'])],
      () => {
        chains.push(causation.current().description);
        return done('a');
      },
      { stored: stored() },
    );

    await hooked.workOne();

    expect(chains).toEqual([
      'task.moved of Add a column (triage → build) → the hook audit',
    ]);
  });

  it('names the firing to the steps, so what they call can say what caused it', async () => {
    const firings: unknown[] = [];
    const { hooked } = setUp(
      [hookNamed('audit', ['a'])],
      (request) => {
        firings.push(request.instance.firing);
        return done('a');
      },
      { stored: stored() },
    );

    await hooked.workOne();

    expect(firings).toEqual([HookFiringId.of('firing_1')]);
  });
});

describe('WorkHookFirings.workOne, guarding against loops', () => {
  const looped = CausalChain.none()
    .append(MOVED)
    .append(AUDIT)
    .append({
      kind: 'delivery',
      key: 'delivery:slack',
      description: 'a delivery from slack',
    })
    .append(MOVED);

  it('stops a hook that its own firing caused again, and reports it on the task, naming the chain', async () => {
    const { hooked, saved, last, take, notes, telemetry } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped }) },
    );

    await hooked.workOne();

    expect(telemetry.counted).toEqual([
      {
        metric: 'spotlight.hook_firings',
        attributes: { 'spotlight.hook_firing.outcome': 'loop_stopped' },
      },
    ]);

    expect(take).not.toHaveBeenCalled();
    expect(notes.failed).toHaveBeenCalledWith({
      taskId: 'task_1',
      stationKey: 'implementation',
      hook: 'audit',
      code: 'loop',
      reason:
        'Hook audit was stopped to prevent a loop. It would fire again for the change that caused it. Cause chain: task.moved of Add a column (triage → build) → the hook audit → a delivery from slack → task.moved of Add a column (triage → build) → the hook audit',
      receivedAs: 'loop:firing_1',
    });
    expect(saved[0]?.stoppedForLooping).toBe(true);
    expect(saved[0]?.progress.kind).toBe('working');
    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure?.code).toBe('loop');
  });

  it('stops a chain that has grown too deep', async () => {
    let deep = CausalChain.none();
    for (let each = 0; each < 8; each += 1) {
      deep = deep.append({ ...MOVED, key: `step-${each}` });
    }
    const { hooked, notes, take } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: deep }) },
    );

    await hooked.workOne();

    expect(take).not.toHaveBeenCalled();
    expect(vi.mocked(notes.failed).mock.calls[0]?.[0]?.reason).toContain(
      'Maximum depth: 8',
    );
  });

  it('stops a hook that keeps firing for the same change, where nothing carried the chain back', async () => {
    const { hooked, take, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored(), repeats: 3 },
    );

    await hooked.workOne();

    expect(take).not.toHaveBeenCalled();
    expect(vi.mocked(notes.failed).mock.calls[0]?.[0]?.reason).toContain(
      'fired 3 times for the same change in the last 10 minutes',
    );
  });

  it('lets a hook fire again for the same change now and then', async () => {
    const { hooked, take, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored(), repeats: 2 },
    );

    await hooked.workOne();

    expect(take).toHaveBeenCalled();
    expect(notes.failed).not.toHaveBeenCalled();
  });

  it('reports a stop it already stored again, however the chain reads now', async () => {
    const stoppedBefore = HookFailure.of(
      'loop',
      'The hook audit was stopped: before',
    );
    const { hooked, saved, take, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ failure: stoppedBefore }), repeats: 0 },
    );

    await hooked.workOne();

    expect(take).not.toHaveBeenCalled();
    expect(saved).toHaveLength(1);
    expect(notes.failed).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'The hook audit was stopped: before',
        receivedAs: 'loop:firing_1',
      }),
    );
  });

  it('reports nothing when another worker claimed the firing before its stop was stored', async () => {
    const { hooked, firings, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped }) },
    );
    const claim = firings.save.getMockImplementation();
    firings.save
      .mockImplementationOnce(async (firing: HookFiring) => claim?.(firing))
      .mockRejectedValueOnce(new HookFiringVersionConflictError('firing_1'));

    await expect(hooked.workOne()).resolves.toBe(true);

    expect(notes.failed).not.toHaveBeenCalled();
    expect(firings.save).toHaveBeenCalledTimes(2);
  });

  it('never reports a loop for a merged pull request its hook does not match after all', async () => {
    const { hooked, notes, last } = setUp(
      [hookNamed('dba', ['tell'])],
      () => done('tell'),
      { whenHolds: () => false, repeats: 5, stored: stored(MERGED) },
    );

    await hooked.workOne();

    expect(notes.failed).not.toHaveBeenCalled();
    expect(last()?.progress).toMatchObject({ because: 'no-longer-matches' });
  });

  it('stores a stop it could not yet report, to report it again later', async () => {
    const { hooked, last, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped }) },
    );
    vi.mocked(notes.failed).mockRejectedValueOnce(new Error('db went away'));

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'pending', dueAt: later(2_000) });
    expect(last()?.failure?.code).toBe('loop');
  });

  it('ends a stop it could never report as a loop, after its last attempt', async () => {
    const { hooked, last, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped, attempts: 7 }) },
    );
    vi.mocked(notes.failed).mockRejectedValueOnce(new Error('db went away'));

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure?.code).toBe('loop');
  });

  it('ends a stop it stored when Spotlight itself fails before the notice, as one no retry mends', async () => {
    const stoppedBefore = HookFailure.of(
      'loop',
      'The hook audit was stopped: before',
    );
    const { hooked, last, runtime } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ failure: stoppedBefore }) },
    );
    vi.mocked(runtime.hook).mockRejectedValueOnce(new Error('db went away'));

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure).toEqual(HookFailure.errored('db went away'));
  });

  it('never stops a firing already partway through its steps', async () => {
    const { hooked, take, notes } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (request) => done(request.step),
      {
        stored: stored({
          cause: looped,
          steps: [{ name: HookStepName.of('a'), status: 'done', output: null }],
        }),
        repeats: 9,
      },
    );

    await hooked.workOne();

    expect(notes.failed).not.toHaveBeenCalled();
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('supersedes a loop on a task that has moved on, and reports nothing', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped }), notice: 'superseded' },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'superseded', at: NOW });
  });

  it('waits on a host without spending an attempt', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => ({
        outcome: {
          name: HookStepName.of('a'),
          status: 'waiting',
          call: 'call_1',
          until: new Date('2026-09-26T10:05:00.000Z'),
        },
        denyReason: null,
        trace: null,
      }),
      { stored: stored() },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'pending', dueAt: later(2_000) });
    expect(last()?.attempts).toBe(0);
    expect(last()?.steps).toEqual([
      expect.objectContaining({
        name: HookStepName.of('a'),
        status: 'waiting',
      }),
    ]);
  });

  it('resumes the step it was waiting on', async () => {
    const resumed: unknown[] = [];
    const waiting = {
      name: HookStepName.of('a'),
      status: 'waiting' as const,
      call: 'call_1',
      until: new Date('2026-09-26T10:05:00.000Z'),
    };
    const { hooked } = setUp(
      [hookNamed('audit', ['a'])],
      (request) => {
        resumed.push(request.resuming);
        return done('a');
      },
      { stored: stored({ steps: [waiting] }) },
    );

    await hooked.workOne();

    expect(resumed).toEqual([waiting]);
  });

  it('matches a merged pull request once it knows what it changed', async () => {
    const seen: unknown[] = [];
    const { hooked, saved } = setUp(
      [hookNamed('dba', ['tell'])],
      (request) => {
        seen.push(request.instance.event);
        return done('tell');
      },
      { stored: stored(MERGED) },
    );

    await hooked.workOne();

    expect(saved[0]?.matched).toBe(true);
    expect(saved[0]?.event).toEqual(
      expect.objectContaining({ changed: ['db/migrations/1.sql'] }),
    );
    expect(seen).toEqual([
      expect.objectContaining({ changed: ['db/migrations/1.sql'] }),
    ]);
  });

  it('lets a merged pull request go when it does not match after all', async () => {
    const { hooked, last, take } = setUp(
      [hookNamed('dba', ['tell'])],
      () => done('tell'),
      { whenHolds: () => false, stored: stored(MERGED) },
    );

    await hooked.workOne();

    expect(take).not.toHaveBeenCalled();
    expect(last()?.progress).toMatchObject({ because: 'no-longer-matches' });
  });

  it('keeps steps done under their names when the hook changes between attempts', async () => {
    const requested: string[] = [];
    const { hooked } = setUp(
      [hookNamed('audit', ['first', 'added', 'second'])],
      (each) => {
        requested.push(each.step.value);
        return done(each.step);
      },
      {
        stored: stored({
          steps: [
            { name: HookStepName.of('first'), status: 'done', output: null },
            { name: HookStepName.of('second'), status: 'done', output: null },
          ],
        }),
      },
    );

    await hooked.workOne();

    expect(requested).toEqual(['added']);
  });

  it('stops delivering once another worker has the lease on the firing', async () => {
    const requested: string[] = [];
    const { hooked, firings, last } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (each) => {
        requested.push(each.step.value);
        return done(each.step);
      },
      { stored: stored() },
    );
    const claim = firings.save.getMockImplementation();
    firings.save
      .mockImplementationOnce(async (firing: HookFiring) => claim?.(firing))
      .mockRejectedValueOnce(new HookFiringVersionConflictError('firing_1'));

    await expect(hooked.workOne()).resolves.toBe(true);

    expect(requested).toEqual(['a']);
    expect(last()).toBeUndefined();
  });

  it('lets a firing of a deleted hook go', async () => {
    const { hooked, last } = setUp([], () => done('a'), {
      stored: stored(),
    });

    await hooked.workOne();

    expect(last()?.progress).toEqual({
      kind: 'skipped',
      at: NOW,
      because: 'hook-deleted',
    });
  });
});

describe('WorkHookFirings.processDue', () => {
  it('works due firings up to its limit', async () => {
    const { hooked } = setUp([hookNamed('audit', ['a'])], () => done('a'), {
      stored: stored(),
    });

    await expect(hooked.processDue()).resolves.toBe(1);
  });
});

describe('WorkHookFirings, reading a merged pull request', () => {
  it('asks GitHub what the pull request changed', async () => {
    const { hooked, changedIn } = setUp(
      [hookNamed('dba', ['tell'])],
      () => done('tell'),
      { stored: stored(MERGED) },
    );

    await hooked.workOne();

    expect(changedIn).toHaveBeenCalledWith(
      WorkspaceId.of('workspace_1'),
      Repository.of('acme/api'),
      PullRequestUrl.of('https://github.com/acme/api/pull/7'),
    );
  });
});
