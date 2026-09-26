import type {
  HookFiringsPort,
  StoredFiring,
} from '@integrations/application/ports/hook-firings.port';
import type {
  HookRuntimePort,
  ListeningHook,
  StepAsked,
  StepTaken,
} from '@integrations/application/ports/hook-runtime.port';
import { HookFirings } from '@integrations/application/services/hook-firings.service';
import type { HookTracesPort } from '@work/application/ports/hook-traces.port';
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const TASK: HookedTaskDto = {
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

const failed = (name: string, reason = 'was answered 503'): StepTaken => ({
  outcome: { name, status: 'failed', reason, output: null },
  refusal: null,
  trace: null,
});

const setUp = (
  hooks: ListeningHook[],
  step: (asked: StepAsked) => StepTaken,
  {
    matches = () => true,
    stored = null,
  }: { matches?: () => boolean; stored?: StoredFiring | null } = {},
) => {
  const runtime: HookRuntimePort = {
    listening: vi.fn(async () => hooks),
    hook: vi.fn(async (id) => hooks.find((each) => each.id === id) ?? null),
    matches: vi.fn(matches),
    step: vi.fn(async (asked) => step(asked)),
  };
  let claimed = stored;
  const firings = {
    fire: vi.fn(async () => true),
    claimNext: vi.fn(async () => {
      const found = claimed;
      claimed = null;
      return found;
    }),
    stepped: vi.fn(async () => true),
    matched: vi.fn(async () => true),
    worked: vi.fn(async () => {}),
    waitAt: vi.fn(async () => {}),
    retryAt: vi.fn(async () => {}),
    failed: vi.fn(async () => {}),
    forgetFinished: vi.fn(async () => 0),
  } satisfies HookFiringsPort;
  const tasks = {
    of: vi.fn(async () => TASK),
    ofPullRequest: vi.fn(async () => TASK),
  } satisfies HookedTasksPort;
  const traces = { record: vi.fn(async () => {}) } satisfies HookTracesPort;
  let ids = 0;

  return {
    runtime,
    firings,
    traces,
    hooked: new HookFirings(
      runtime,
      firings,
      tasks,
      traces,
      {
        open: vi.fn(),
        changedOn: vi.fn(),
        changedIn: vi.fn(async () => ['db/migrations/1.sql']),
      },
      { generate: () => `id_${++ids}` },
      { now: () => NOW, sleep: async () => {} },
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ),
  };
};

const EVENT = { tool: 'grafana.search', inputs: { query: 'cpu' } };

describe('HookFirings.before', () => {
  it('allows the event when every step succeeds, tracing each call', async () => {
    const { hooked, traces } = setUp([hookNamed('audit', ['tell'])], (asked) =>
      done(asked.step),
    );

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual({
      kind: 'allowed',
    });
    expect(traces.record).toHaveBeenCalledWith(
      'run_1',
      expect.objectContaining({ step: 'tell' }),
    );
  });

  it('refuses when an endpoint says so', async () => {
    const { hooked } = setUp([hookNamed('dba', ['ask'])], () => ({
      ...done('ask'),
      refusal: 'the migration drops a column in use',
    }));

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual({
      kind: 'refused',
      reason: 'The hook dba refused: the migration drops a column in use',
    });
  });

  it('refuses plainly when a blocking hook cannot reach its endpoint', async () => {
    const { hooked } = setUp([hookNamed('dba', ['ask'], true)], () =>
      failed('ask', 'could not reach https://dba.example.com: timed out'),
    );

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual({
      kind: 'refused',
      reason:
        'The hook dba failed at ask (could not reach https://dba.example.com: timed out), and it blocks on failure',
    });
  });

  it('treats a step that throws as failed, blocking only when the hook blocks', async () => {
    const throwing = () => {
      throw new Error('the callback token could not be minted');
    };
    const blocking = setUp([hookNamed('dba', ['ask'], true)], throwing);
    const continuing = setUp([hookNamed('audit', ['ask'])], throwing);

    await expect(
      blocking.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual({
      kind: 'refused',
      reason:
        'The hook dba failed at ask (the callback token could not be minted), and it blocks on failure',
    });
    await expect(
      continuing.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual({ kind: 'allowed' });
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
    });
    const blocking = setUp([broken(true)], () => done('ask'));
    const continuing = setUp([broken(false)], () => done('ask'));

    await expect(
      blocking.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual({
      kind: 'refused',
      reason:
        'The hook dba no longer reads as it was written (when No such key: gone), and it blocks on failure',
    });
    await expect(
      continuing.hooked.before(TASK, 'tool.using', EVENT),
    ).resolves.toEqual({ kind: 'allowed' });
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

    await expect(hooked.before(TASK, 'tool.using', EVENT)).resolves.toEqual({
      kind: 'allowed',
    });
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

describe('HookFirings.happened', () => {
  it('queues one firing per matching hook, keyed by the occurrence', async () => {
    const { hooked, firings } = setUp(
      [hookNamed('a', ['x']), hookNamed('b', ['y'])],
      () => done('x'),
    );

    await expect(
      hooked.happened({
        on: 'tool.used',
        occurrence: 'occurrence_1',
        task: TASK,
        event: EVENT,
      }),
    ).resolves.toBe(2);
    expect(firings.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        hookId: 'a_id',
        occurrence: 'occurrence_1',
        runId: 'run_1',
      }),
    );
  });
});

const stored = (overrides: Partial<StoredFiring> = {}): StoredFiring => ({
  id: 'firing_1',
  hookId: 'audit_id',
  workspaceId: 'workspace_1',
  teamId: 'team_1',
  taskId: 'task_1',
  runId: 'run_1',
  on: 'tool.used',
  occurrence: 'occurrence_1',
  at: NOW,
  event: EVENT,
  matched: true,
  steps: [],
  attempts: 0,
  claimedAt: NOW,
  ...overrides,
});

describe('HookFirings.workOne', () => {
  it('delivers every step and marks the firing worked', async () => {
    const { hooked, firings } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (asked) => done(asked.step),
      { stored: stored() },
    );

    await expect(hooked.workOne()).resolves.toBe(true);
    expect(firings.worked).toHaveBeenCalled();
    expect(firings.stepped).toHaveBeenLastCalledWith(expect.anything(), [
      expect.objectContaining({ name: 'a', status: 'done' }),
      expect.objectContaining({ name: 'b', status: 'done' }),
    ]);
  });

  it('retries from the failed step, keeping the steps already done', async () => {
    const asked: number[] = [];
    const { hooked, firings } = setUp(
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
    expect(firings.retryAt).toHaveBeenCalledWith(
      expect.anything(),
      'The hook audit failed at b: was answered 503',
      new Date(NOW.getTime() + 4_000),
    );
  });

  it('gives up after the last attempt', async () => {
    const { hooked, firings } = setUp(
      [hookNamed('audit', ['a'])],
      () => failed('a'),
      { stored: stored({ attempts: 7 }) },
    );

    await hooked.workOne();

    expect(firings.failed).toHaveBeenCalled();
  });

  it('waits on a host without spending an attempt', async () => {
    const { hooked, firings } = setUp(
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

    expect(firings.waitAt).toHaveBeenCalledWith(
      expect.anything(),
      new Date(NOW.getTime() + 2_000),
    );
    expect(firings.retryAt).not.toHaveBeenCalled();
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
    const { hooked, firings } = setUp(
      [hookNamed('dba', ['tell'])],
      (asked) => {
        seen.push(asked.moment.event);
        return done('tell');
      },
      {
        stored: stored({
          hookId: 'dba_id',
          on: 'pull-request.merged',
          matched: false,
          event: {
            url: 'https://github.com/acme/api/pull/7',
            repository: 'acme/api',
            mergeCommit: 'abc',
          },
        }),
      },
    );

    await hooked.workOne();

    expect(firings.matched).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ changed: ['db/migrations/1.sql'] }),
    );
    expect(seen).toEqual([
      expect.objectContaining({ changed: ['db/migrations/1.sql'] }),
    ]);
  });

  it('lets a merged pull request go when it does not match after all', async () => {
    const { hooked, firings, runtime } = setUp(
      [hookNamed('dba', ['tell'])],
      () => done('tell'),
      {
        matches: () => false,
        stored: stored({
          hookId: 'dba_id',
          on: 'pull-request.merged',
          matched: false,
          event: {
            url: 'https://github.com/acme/api/pull/7',
            repository: 'acme/api',
            mergeCommit: 'abc',
          },
        }),
      },
    );

    await hooked.workOne();

    expect(runtime.step).not.toHaveBeenCalled();
    expect(firings.worked).toHaveBeenCalled();
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
    const { hooked, firings } = setUp(
      [hookNamed('audit', ['a', 'b'])],
      (each) => {
        asked.push(each.step);
        return done(each.step);
      },
      { stored: stored() },
    );
    vi.mocked(firings.stepped).mockResolvedValueOnce(false);

    await hooked.workOne();

    expect(asked).toEqual(['a']);
    expect(firings.worked).not.toHaveBeenCalled();
  });

  it('lets a firing of a deleted hook go', async () => {
    const { hooked, firings } = setUp([], () => done('a'), {
      stored: stored(),
    });

    await hooked.workOne();

    expect(firings.worked).toHaveBeenCalled();
  });
});
