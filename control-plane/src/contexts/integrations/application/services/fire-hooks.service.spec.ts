import type { HookCallsPort } from '@integrations/application/ports/hook-calls.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type {
  HookRuntimePort,
  ListeningHook,
  StepAsked,
  StepTaken,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  HookedTask,
  TasksForHooksPort,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { FireHooks } from '@integrations/application/services/fire-hooks.service';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { Hook } from '@integrations/domain/entities/hook.entity';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import {
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import { causationInMemory } from '@shared-kernel/application/ports/causation.fake-spec';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import type {
  HookFailureHeard,
  HookFailureReport,
  TaskNotesFromHooksPort,
} from '@work/application/ports/task-notes-from-hooks.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const TASK: HookedTask = {
  taskId: 'task_1',
  workspaceId: 'workspace_1',
  teamId: 'team_1',
  title: 'Add a column',
  url: 'https://spotlight.example.com/t/1',
  line: 'delivery',
  station: 'Implementation',
  stationKey: 'implementation',
  marks: {},
  repositories: ['acme/api'],
  pullRequest: null,
  runId: 'run_1',
};

const hookNamed = (
  key: string,
  steps: string[],
  blocks = false,
): ListeningHook => ({
  id: `${key}_id`,
  key,
  teamId: 'team_1',
  blocks,
  timeoutSeconds: 10,
  steps,
  broken: null,
  written: Hook.of({
    key: HookKey.of(key),
    event: HookEvent.of('tool.using'),
    match: { tools: [], paths: [] },
    steps: steps.map((name) => ({
      name,
      kind: 'request' as const,
      url: new URL('https://a.example.com'),
      fromNetwork: false,
    })),
    signing: 'hmac',
    failure: blocks ? 'block' : 'continue',
    timeoutSeconds: 10,
  }),
});

const done = (name: string, output: unknown = null): StepTaken => ({
  outcome: { name, status: 'done', output },
  refusal: null,
  trace: {
    hook: 'k',
    step: name,
    kind: 'request',
    target: 'https://a.example.com',
    request: {},
    response: output,
    status: 200,
    failed: false,
    startedAt: NOW,
    ms: 3,
  },
});

const failed = (
  name: string,
  reason = 'was answered 503',
  code: HookFailureCode = 'server-error',
): StepTaken => ({
  outcome: { name, status: 'failed', code, reason, output: null },
  refusal: null,
  trace: null,
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

const firingsInMemory = (stored: HookFiring | null) => {
  const kept = new Map<string, HookFiring>(stored ? [[stored.id, stored]] : []);
  const saved: HookFiring[] = [];
  const firings = {
    add: vi.fn(async (_firing: HookFiring) => true),
    withId: vi.fn(async (id: string) => kept.get(id) ?? null),
    claimNext: vi.fn(async (now: Date) => {
      const due = [...kept.values()].find(
        (each) =>
          each.progress.kind === 'pending' &&
          each.progress.dueAt.getTime() <= now.getTime(),
      );

      if (!due) {
        return null;
      }

      kept.set(
        due.id,
        HookFiring.rehydrate({
          ...stateOf(due.claimed(now)),
          version: due.version + 1,
        }),
      );

      return kept.get(due.id) ?? null;
    }),
    save: vi.fn(async (firing: HookFiring) => {
      if (kept.get(firing.id)?.version !== firing.version) {
        throw new HookFiringVersionConflictError(firing.id);
      }

      saved.push(firing);
      kept.set(
        firing.id,
        HookFiring.rehydrate({
          ...stateOf(firing),
          version: firing.version + 1,
        }),
      );
    }),
    finishedBefore: vi.fn(
      async (_at: Date, _most: number): Promise<readonly HookFiring[]> => [],
    ),
  } satisfies HookFiringRepository;

  return {
    firings,
    saved,
    last: (): HookFiring | undefined => saved[saved.length - 1],
  };
};

const setUp = (
  hooks: ListeningHook[],
  step: (asked: StepAsked) => StepTaken,
  {
    matches = () => true,
    stored = null,
    standing = TASK,
    repeats = 0,
    heard = 'reported',
    movedOn = false,
  }: {
    matches?: () => boolean;
    stored?: HookFiring | null;
    standing?: HookedTask | null;
    repeats?: number;
    heard?: HookFailureHeard;
    movedOn?: boolean;
  } = {},
) => {
  const runtime: HookRuntimePort = {
    listening: vi.fn(async () => hooks),
    hook: vi.fn(async (id) => hooks.find((each) => each.id === id) ?? null),
    matches: vi.fn(matches),
    step: vi.fn(async (asked) => step(asked)),
  };
  const kept = firingsInMemory(stored);
  const history = {
    recentRepeats: vi.fn(async () => repeats),
    chainOf: vi.fn(async () => null),
  } satisfies HookFiringHistoryPort;
  const tasks = {
    of: vi.fn(async () => standing),
    ofPullRequest: vi.fn(async () => standing),
  } satisfies TasksForHooksPort;
  const notes = {
    noted: vi.fn(async () => true),
    failed: vi.fn(async (_report: HookFailureReport) => heard),
    movedOn: vi.fn(async () => movedOn),
  } satisfies TaskNotesFromHooksPort;
  const causation = causationInMemory();
  const calls = { record: vi.fn(async () => {}) } satisfies HookCallsPort;
  let ids = 0;

  return {
    runtime,
    ...kept,
    calls,
    notes,
    causation,
    hooked: new FireHooks(
      runtime,
      kept.firings,
      history,
      tasks,
      notes,
      calls,
      {
        open: vi.fn(),
        changedOn: vi.fn(),
        changedIn: vi.fn(async () => ['db/migrations/1.sql']),
      },
      { generate: () => `id_${++ids}` },
      { now: () => NOW, sleep: async () => {} },
      causation,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ),
  };
};

const EVENT = { tool: 'grafana.search', inputs: { query: 'cpu' } };

const ALLOWED = HookVerdict.allowed();

describe('FireHooks.before', () => {
  it('allows the event when every step succeeds, tracing each call', async () => {
    const { hooked, calls } = setUp([hookNamed('audit', ['tell'])], (asked) =>
      done(asked.step),
    );

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual(
      ALLOWED,
    );
    expect(calls.record).toHaveBeenCalledWith(
      'run_1',
      expect.objectContaining({ step: 'tell' }),
    );
  });

  it('refuses when an endpoint says so', async () => {
    const { hooked } = setUp([hookNamed('dba', ['ask'])], () => ({
      ...done('ask'),
      refusal: 'the migration drops a column in use',
    }));

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual(
      HookVerdict.refused(
        'Hook dba refused. Reason: the migration drops a column in use',
      ),
    );
  });

  it('refuses plainly when a blocking hook cannot reach its endpoint', async () => {
    const { hooked } = setUp([hookNamed('dba', ['ask'], true)], () =>
      failed('ask', 'could not reach https://dba.example.com: timed out'),
    );

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual(
      HookVerdict.refused(
        'Hook dba failed at step ask and blocks on failure. Reason: could not reach https://dba.example.com: timed out',
      ),
    );
  });

  it('treats a step that throws as failed, blocking only when the hook blocks', async () => {
    const throwing = () => {
      throw new Error('the callback token could not be minted');
    };
    const blocking = setUp([hookNamed('dba', ['ask'], true)], throwing);
    const continuing = setUp([hookNamed('audit', ['ask'])], throwing);

    await expect(
      blocking.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual(
      HookVerdict.refused(
        'Hook dba failed at step ask and blocks on failure. Reason: the callback token could not be minted',
      ),
    );
    await expect(
      continuing.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual(ALLOWED);
  });

  it('shares one minute across every hook before an event when no deadline is given', async () => {
    const deadlines: Date[] = [];
    const { hooked } = setUp(
      [{ ...hookNamed('slow', ['tell']), timeoutSeconds: 30 }],
      (asked) => {
        deadlines.push(asked.deadline);
        return done('tell');
      },
    );

    await hooked.before(TASK, 'tool.using', EVENT);

    expect(deadlines).toEqual([new Date(NOW.getTime() + 30_000)]);
  });

  it('refuses when a blocking hook no longer reads as it was written, and skips one that continues', async () => {
    const broken = (blocks: boolean) => ({
      ...hookNamed('dba', ['ask'], blocks),
      broken: 'when No such key: gone',
      written: null,
    });
    const blocking = setUp([broken(true)], () => done('ask'));
    const continuing = setUp([broken(false)], () => done('ask'));

    await expect(
      blocking.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual(
      HookVerdict.refused(
        'Hook dba is broken and blocks on failure. Reason: when No such key: gone',
      ),
    );
    await expect(
      continuing.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual(ALLOWED);
    expect(continuing.runtime.step).not.toHaveBeenCalled();
  });

  it('keeps every hook within the deadline it is given', async () => {
    const deadlines: Date[] = [];
    const { hooked } = setUp([hookNamed('audit', ['tell'])], (asked) => {
      deadlines.push(asked.deadline);
      return done('tell');
    });
    const until = new Date(NOW.getTime() + 3_000);

    await hooked.before(TASK, 'run.starting', {}, until);

    expect(deadlines).toEqual([until]);
  });

  it('lets the event go on when a hook that continues fails, and stops its later steps', async () => {
    const { hooked, runtime } = setUp(
      [hookNamed('audit', ['first', 'second'])],
      () => failed('first'),
    );

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual(
      ALLOWED,
    );
    expect(runtime.step).toHaveBeenCalledTimes(1);
  });

  it('skips hooks whose match does not hold', async () => {
    const { hooked, runtime } = setUp(
      [hookNamed('audit', ['tell'])],
      () => done('tell'),
      { matches: () => false },
    );

    await hooked.before(TASK, 'tool.using', EVENT);

    expect(runtime.step).not.toHaveBeenCalled();
  });

  it('hands later steps the outputs of earlier ones', async () => {
    const seen: number[] = [];
    const { hooked } = setUp([hookNamed('audit', ['a', 'b'])], (asked) => {
      seen.push(asked.earlier.length);
      return done(asked.step, 'out');
    });

    await hooked.before(TASK, 'tool.using', EVENT);

    expect(seen).toEqual([0, 1]);
  });
});

describe('FireHooks.happened', () => {
  it('queues one firing per matching hook, keyed by the occurrence', async () => {
    const { hooked, firings } = setUp(
      [hookNamed('a', ['x']), hookNamed('b', ['y'])],
      () => done('x'),
    );

    await expect(
      hooked.happened({
        on: 'tool.used',
        occurrence: 'occurrence_1',
        change: 'grafana.search',
        task: TASK,
        event: EVENT,
      }),
    ).resolves.toBe(2);

    const [fired] = vi.mocked(firings.add).mock.calls[0] ?? [];
    expect(fired).toMatchObject({
      hookId: 'a_id',
      occurrence: 'occurrence_1',
      runId: 'run_1',
      stationKey: 'implementation',
      link: {
        kind: 'hook',
        key: 'hook:a_id:tool.used:task_1:grafana.search',
        saying: 'the hook a',
      },
      progress: { kind: 'pending', dueAt: NOW },
    });
  });

  it('fires in the chain of causes it happened in, followed by what happened', async () => {
    const { hooked, firings, causation } = setUp([hookNamed('a', ['x'])], () =>
      done('x'),
    );
    const delivered = CausalChain.none().followedBy({
      kind: 'delivery',
      key: 'delivery:slack',
      saying: 'a delivery from slack',
    });

    await causation.within(delivered, () =>
      hooked.happened({
        on: 'task.moved',
        occurrence: 'moved_1',
        change: 'triage → build',
        task: TASK,
        event: { from: 'triage', to: 'build' },
      }),
    );

    const [fired] = vi.mocked(firings.add).mock.calls[0] ?? [];
    expect(fired?.cause.saying).toBe(
      'a delivery from slack → task.moved of Add a column (triage → build)',
    );
  });
});

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

const stored = (
  overrides: Partial<ReturnType<typeof stateOf>> = {},
): HookFiring =>
  HookFiring.rehydrate({
    ...stateOf(
      HookFiring.fired({
        id: 'firing_1',
        hookId: 'audit_id',
        workspaceId: 'workspace_1',
        teamId: 'team_1',
        taskId: 'task_1',
        runId: 'run_1',
        stationKey: 'implementation',
        on: 'tool.used',
        occurrence: 'occurrence_1',
        firedAt: NOW,
        event: EVENT,
        matched: true,
        cause: CausalChain.none().followedBy(MOVED),
        link: AUDIT,
      }),
    ),
    version: 1,
    ...overrides,
  });

const MERGED = {
  hookId: 'dba_id',
  on: 'pull-request.merged' as const,
  matched: false,
  event: {
    url: 'https://github.com/acme/api/pull/7',
    repository: 'acme/api',
    mergeCommit: 'abc',
  },
};

const later = (ms: number) => new Date(NOW.getTime() + ms);

describe('FireHooks.workOne', () => {
  it('delivers every step and marks the firing worked', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (asked) => done(asked.step),
      { stored: stored() },
    );

    await expect(hooked.workOne()).resolves.toBe(true);
    expect(last()?.progress).toEqual({ kind: 'done', at: NOW });
    expect(last()?.steps).toEqual([
      expect.objectContaining({ name: 'a', status: 'done' }),
      expect.objectContaining({ name: 'b', status: 'done' }),
    ]);
  });

  it('has nothing to do when no firing is due', async () => {
    const { hooked } = setUp([hookNamed('audit', ['a'])], () => done('a'));

    await expect(hooked.workOne()).resolves.toBe(false);
  });

  it('retries from the failed step, keeping the steps already done', async () => {
    const asked: number[] = [];
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (each) => {
        asked.push(each.earlier.length);
        return failed('b');
      },
      {
        stored: stored({
          steps: [{ name: 'a', status: 'done', output: null }],
          attempts: 1,
        }),
      },
    );

    await hooked.workOne();

    expect(asked).toEqual([1]);
    expect(last()?.progress).toEqual({ kind: 'pending', dueAt: later(4_000) });
    expect(last()?.failure).toEqual(
      HookFailure.of(
        'server-error',
        'Hook audit failed at step b. Reason: was answered 503',
      ),
    );
  });

  it('gives up after the last attempt', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => failed('a'),
      { stored: stored({ attempts: 7 }) },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure?.code).toBe('server-error');
  });

  it('gives up at once on a failure that may not be retried', async () => {
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

  it('asks nothing of the task while the firing will be tried again', async () => {
    const { hooked, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => failed('a'),
      { stored: stored(), movedOn: true },
    );

    await hooked.workOne();

    expect(notes.movedOn).not.toHaveBeenCalled();
  });

  it('supersedes a firing whose task is gone, telling nobody', async () => {
    const { hooked, last, runtime } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored(), standing: null },
    );

    await hooked.workOne();

    expect(runtime.step).not.toHaveBeenCalled();
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
        chains.push(causation.current().saying);
        return done('a');
      },
      { stored: stored() },
    );

    await hooked.workOne();

    expect(chains).toEqual([
      'task.moved of Add a column (triage → build) → the hook audit',
    ]);
  });

  it('names the firing to the steps, so what they reach can say what caused it', async () => {
    const firings: (string | null)[] = [];
    const { hooked } = setUp(
      [hookNamed('audit', ['a'])],
      (asked) => {
        firings.push(asked.moment.firing);
        return done('a');
      },
      { stored: stored() },
    );

    await hooked.workOne();

    expect(firings).toEqual(['firing_1']);
  });
});

describe('FireHooks.workOne, guarding against loops', () => {
  const looped = CausalChain.none()
    .followedBy(MOVED)
    .followedBy(AUDIT)
    .followedBy({
      kind: 'delivery',
      key: 'delivery:slack',
      saying: 'a delivery from slack',
    })
    .followedBy(MOVED);

  it('stops a hook that its own firing caused again, and asks about the task, naming the chain', async () => {
    const { hooked, saved, last, runtime, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped }) },
    );

    await hooked.workOne();

    expect(runtime.step).not.toHaveBeenCalled();
    expect(notes.failed).toHaveBeenCalledWith({
      taskId: 'task_1',
      stationKey: 'implementation',
      hook: 'audit',
      code: 'loop',
      saying:
        'Hook audit was stopped to prevent a loop. It would fire again for the change that caused it. Cause chain: task.moved of Add a column (triage → build) → the hook audit → a delivery from slack → task.moved of Add a column (triage → build) → the hook audit',
      heardAs: 'loop:firing_1',
    });
    expect(saved[0]?.stoppedForLooping).toBe(true);
    expect(saved[0]?.progress.kind).toBe('working');
    expect(last()?.progress).toEqual({ kind: 'failed', at: NOW });
    expect(last()?.failure?.code).toBe('loop');
  });

  it('stops a chain that has grown too deep', async () => {
    let deep = CausalChain.none();
    for (let each = 0; each < 8; each += 1) {
      deep = deep.followedBy({ ...MOVED, key: `step-${each}` });
    }
    const { hooked, notes, runtime } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: deep }) },
    );

    await hooked.workOne();

    expect(runtime.step).not.toHaveBeenCalled();
    expect(vi.mocked(notes.failed).mock.calls[0]?.[0]?.saying).toContain(
      'Maximum depth: 8',
    );
  });

  it('stops a hook that keeps firing for the same change, where nothing carried the chain back', async () => {
    const { hooked, runtime, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored(), repeats: 3 },
    );

    await hooked.workOne();

    expect(runtime.step).not.toHaveBeenCalled();
    expect(vi.mocked(notes.failed).mock.calls[0]?.[0]?.saying).toContain(
      'fired 3 times for the same change in the last 10 minutes',
    );
  });

  it('lets a hook fire again for the same change now and then', async () => {
    const { hooked, runtime, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored(), repeats: 2 },
    );

    await hooked.workOne();

    expect(runtime.step).toHaveBeenCalled();
    expect(notes.failed).not.toHaveBeenCalled();
  });

  it('reports a stop it already kept again, however the chain reads now', async () => {
    const kept = HookFailure.of('loop', 'The hook audit was stopped: before');
    const { hooked, saved, runtime, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ failure: kept }), repeats: 0 },
    );

    await hooked.workOne();

    expect(runtime.step).not.toHaveBeenCalled();
    expect(saved).toHaveLength(1);
    expect(notes.failed).toHaveBeenCalledWith(
      expect.objectContaining({
        saying: 'The hook audit was stopped: before',
        heardAs: 'loop:firing_1',
      }),
    );
  });

  it('reports nothing when another worker took the firing before its stop was kept', async () => {
    const { hooked, firings, notes } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped }) },
    );
    vi.mocked(firings.save).mockRejectedValueOnce(
      new HookFiringVersionConflictError('firing_1'),
    );

    await expect(hooked.workOne()).resolves.toBe(true);

    expect(notes.failed).not.toHaveBeenCalled();
    expect(firings.save).toHaveBeenCalledTimes(1);
  });

  it('never reports a loop for a merged pull request its hook does not match after all', async () => {
    const { hooked, notes, last } = setUp(
      [hookNamed('dba', ['tell'])],
      () => done('tell'),
      { matches: () => false, repeats: 5, stored: stored(MERGED) },
    );

    await hooked.workOne();

    expect(notes.failed).not.toHaveBeenCalled();
    expect(last()?.progress.kind).toBe('done');
  });

  it('keeps a stop it could not yet tell of, to tell of it again later', async () => {
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

  it('ends a stop it could never tell of as a loop, after its last attempt', async () => {
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

  it('keeps a stop it kept when something else fails before it is told of', async () => {
    const kept = HookFailure.of('loop', 'The hook audit was stopped: before');
    const { hooked, last, runtime } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ failure: kept }) },
    );
    vi.mocked(runtime.hook).mockRejectedValueOnce(new Error('db went away'));

    await hooked.workOne();

    expect(last()?.progress.kind).toBe('pending');
    expect(last()?.failure).toBe(kept);
  });

  it('never stops a firing already partway through its steps', async () => {
    const { hooked, runtime, notes } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (asked) => done(asked.step),
      {
        stored: stored({
          cause: looped,
          steps: [{ name: 'a', status: 'done', output: null }],
        }),
        repeats: 9,
      },
    );

    await hooked.workOne();

    expect(notes.failed).not.toHaveBeenCalled();
    expect(runtime.step).toHaveBeenCalledTimes(1);
  });

  it('supersedes a loop on a task that has moved on, asking nobody', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => done('a'),
      { stored: stored({ cause: looped }), heard: 'superseded' },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'superseded', at: NOW });
  });

  it('waits on a host without spending an attempt', async () => {
    const { hooked, last } = setUp(
      [hookNamed('audit', ['a'])],
      () => ({
        outcome: {
          name: 'a',
          status: 'waiting',
          call: 'call_1',
          until: '2026-09-26T10:05:00.000Z',
        },
        refusal: null,
        trace: null,
      }),
      { stored: stored() },
    );

    await hooked.workOne();

    expect(last()?.progress).toEqual({ kind: 'pending', dueAt: later(2_000) });
    expect(last()?.attempts).toBe(0);
    expect(last()?.steps).toEqual([
      expect.objectContaining({ name: 'a', status: 'waiting' }),
    ]);
  });

  it('resumes the step it was waiting on', async () => {
    const resumed: unknown[] = [];
    const waiting = {
      name: 'a',
      status: 'waiting' as const,
      call: 'call_1',
      until: '2026-09-26T10:05:00.000Z',
    };
    const { hooked } = setUp(
      [hookNamed('audit', ['a'])],
      (asked) => {
        resumed.push(asked.resuming);
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
      (asked) => {
        seen.push(asked.moment.event);
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
    const { hooked, last, runtime } = setUp(
      [hookNamed('dba', ['tell'])],
      () => done('tell'),
      { matches: () => false, stored: stored(MERGED) },
    );

    await hooked.workOne();

    expect(runtime.step).not.toHaveBeenCalled();
    expect(last()?.progress.kind).toBe('done');
  });

  it('keeps steps done under their names when the hook changes between attempts', async () => {
    const asked: string[] = [];
    const { hooked } = setUp(
      [hookNamed('audit', ['first', 'added', 'second'])],
      (each) => {
        asked.push(each.step);
        return done(each.step);
      },
      {
        stored: stored({
          steps: [
            { name: 'first', status: 'done', output: null },
            { name: 'second', status: 'done', output: null },
          ],
        }),
      },
    );

    await hooked.workOne();

    expect(asked).toEqual(['added']);
  });

  it('stops delivering once another worker holds the firing', async () => {
    const asked: string[] = [];
    const { hooked, firings, last } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (each) => {
        asked.push(each.step);
        return done(each.step);
      },
      { stored: stored() },
    );
    vi.mocked(firings.save).mockRejectedValueOnce(
      new HookFiringVersionConflictError('firing_1'),
    );

    await expect(hooked.workOne()).resolves.toBe(true);

    expect(asked).toEqual(['a']);
    expect(last()).toBeUndefined();
  });

  it('lets a firing of a deleted hook go', async () => {
    const { hooked, last } = setUp([], () => done('a'), {
      stored: stored(),
    });

    await hooked.workOne();

    expect(last()?.progress.kind).toBe('done');
  });
});

describe('FireHooks.forgetFinished', () => {
  it('forgets each firing finished a month ago', async () => {
    const finished = HookFiring.rehydrate({
      ...stateOf(stored()),
      progress: { kind: 'done', at: new Date(NOW.getTime() - 31 * 86_400_000) },
    });
    const { hooked, firings, saved } = setUp([], () => done('a'), {
      stored: finished,
    });
    vi.mocked(firings.finishedBefore).mockResolvedValueOnce([finished]);

    await expect(hooked.forgetFinished()).resolves.toBe(1);

    expect(firings.finishedBefore).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 30 * 86_400_000),
      500,
    );
    expect(saved[0]?.isDiscarded).toBe(true);
  });
});
