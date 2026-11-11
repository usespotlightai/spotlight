import type { LineView } from '@lines/application/contracts/line-view.contract';
import type { LinesPort } from '@lines/application/ports/lines.port';
import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import { REMOTE_VIA_GIT_PROXY } from '@runs/application/contracts/run-spec.contract';
import { Runs } from '@runs/application/services/runs.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer } from '@runs/domain/aggregates/run.fake-spec';
import { RunAlreadyExistsError } from '@runs/domain/exceptions/run-already-exists.error';
import { RunOrderConflictError } from '@runs/domain/exceptions/run-order-conflict.error';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import { LinesWarmLines } from '@runs/infrastructure/acl/lines-warm-lines.adapter';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T09:00:00.000Z');

const ORDER: RunOrderContract = {
  runId: 'run_1',
  workspaceId: 'ws_1',
  harness: 'claude-code',
  priority: 0,
  placement: { labelGroups: [], image: null },
  spec: {
    command: { executable: 'claude-agent-acp', args: [] },
    briefing: 'Fix the queue.',
    handover: { options: ['Review'], noteLimit: 4_000 },
    resume: {},
  },
  requester: {
    owner: 'work',
    kind: 'task',
    id: 'task_1',
    token: '2',
    team: 'team_1',
  },
  policy: {
    holdsTurn: true,
    gated: true,
    actsBeyondItself: true,
    asks: 'requester',
    listed: true,
    exclusive: true,
  },
  workingCopy: {
    key: 'work/task-task_1',
    rejoinable: true,
    restores: 'always',
  },
  restore: null,
  extensions: {},
  apiGrant: null,
  tags: { taskId: 'task_1' },
  line: null,
  refusal: null,
};

const ISOLATED: RunOrderContract = {
  ...ORDER,
  requester: {
    owner: 'replays',
    kind: 'replay',
    id: 'run_1',
    token: null,
    team: 'team_1',
  },
  policy: {
    holdsTurn: false,
    gated: false,
    actsBeyondItself: false,
    asks: 'recorded',
    listed: false,
    exclusive: false,
  },
  workingCopy: {
    key: 'replays/replay-run_1',
    rejoinable: false,
    restores: 'when-continuing',
  },
  restore: { archive: 'archive_1' },
  extensions: { replay: { archive: 'archive_1', movesOnAfter: ['spec'] } },
  tags: {},
  line: null,
};

const lineViewOf = (over: Partial<LineView>): LineView =>
  ({
    id: 'line_1',
    workspaceId: 'ws_1',
    runners: [],
    image: null,
    warmSandboxes: 1,
    repositories: [],
    ...over,
  }) as LineView;

const inMemory = () => {
  const stored = new Map<string, Run>();
  const runs = {
    findById: async (id: RunId) => stored.get(id.value) ?? null,
    add: async (run: Run) => {
      if (stored.has(run.id.value)) {
        throw new RunAlreadyExistsError(run.id.value);
      }
      stored.set(run.id.value, run);
    },
    save: async (run: Run) => {
      stored.set(run.id.value, run);
    },
  } as unknown as RunRepository;

  return {
    stored,
    runs: new Runs(
      runs,
      { sha256: (text) => `sha:${text.length}:${text}` },
      { now: () => NOW, sleep: async () => {} },
    ),
  };
};

describe('Runs, the facade other parts of Work order and stop runs through', () => {
  it('enqueues the run an order describes, for the team it names', async () => {
    const { runs, stored } = inMemory();

    await runs.enqueue(ORDER);

    const run = stored.get('run_1');
    expect(run?.state).toBe('queued');
    expect(run?.team?.value).toBe('team_1');
    expect(run?.requester.subject).toBe('work/task/task_1');
    expect(run?.requester.token).toBe('2');
    expect(run?.orderFingerprint).toMatch(/^sha:/);
  });

  it('keeps the setup of the line the run is ordered on as its own checkouts and placement give it, matching the line’s warm sandboxes', async () => {
    const { runs, stored } = inMemory();
    const placement = { labelGroups: [['gpu']], image: null };
    const spec = {
      ...ORDER.spec,
      checkouts: [
        { remote: REMOTE_VIA_GIT_PROXY, path: 'widgets', setup: 'npm ci' },
        { remote: REMOTE_VIA_GIT_PROXY, path: 'api' },
      ],
    };
    const [warm] = await new LinesWarmLines({
      keepingWarmSandboxes: async () => [
        lineViewOf({
          runners: ['gpu'],
          repositories: [
            { repository: 'acme/api', setup: null },
            { repository: 'acme/widgets', setup: 'npm ci' },
          ],
        }),
      ],
    } as unknown as LinesPort).keepingWarmSandboxes();

    await runs.enqueue({ ...ORDER, placement, spec, line: 'line_1' });
    await runs.enqueue({
      ...ORDER,
      runId: 'run_2',
      placement,
      spec: {
        ...spec,
        checkouts: [{ remote: REMOTE_VIA_GIT_PROXY, path: 'widgets' }],
      },
      line: 'line_1',
    });
    await runs.enqueue({ ...ORDER, runId: 'run_3', placement, spec });

    expect(
      stored
        .get('run_1')
        ?.lineFingerprint?.equals(WarmFingerprint.ofSetup(warm)),
    ).toBe(true);
    expect(
      stored
        .get('run_2')
        ?.lineFingerprint?.equals(WarmFingerprint.ofSetup(warm)),
    ).toBe(false);
    expect(stored.get('run_3')?.lineFingerprint).toBeNull();
  });

  it('keeps what the order asks of the run: its working copy, the exact archive, extensions and tags', async () => {
    const { runs, stored } = inMemory();

    await runs.enqueue(ISOLATED);

    const run = stored.get('run_1');
    expect(run?.workingCopyKey?.value).toBe('replays/replay-run_1');
    expect(run?.restore?.value).toBe('archive_1');
    expect(run?.extensions.value).toEqual({
      replay: { archive: 'archive_1', movesOnAfter: ['spec'] },
    });
    expect(run?.tags.value).toEqual({});
    expect(run?.policy.actsBeyondItself).toBe(false);
  });

  it('refuses an order whose working copy belongs to another requester, or whose extension takes the name of a run field', async () => {
    const { runs, stored } = inMemory();

    await expect(
      runs.enqueue({
        ...ISOLATED,
        workingCopy: { ...ORDER.workingCopy, key: 'work/task-task_1' } as never,
      }),
    ).resolves.toMatchObject({ outcome: 'refused' });
    await expect(
      runs.enqueue({
        ...ISOLATED,
        runId: 'run_2',
        extensions: { checkouts: [] },
      }),
    ).resolves.toMatchObject({ outcome: 'refused' });
    expect(stored.size).toBe(0);
  });

  it('refuses an order that keeps the run to itself yet has it act beyond itself', async () => {
    const { runs } = inMemory();

    await expect(
      runs.enqueue({
        ...ISOLATED,
        spec: { ...ISOLATED.spec, injectedSecrets: ['LINEAR_API_KEY'] },
      }),
    ).resolves.toMatchObject({ outcome: 'refused' });
  });

  it('does nothing when the same order comes again', async () => {
    const { runs, stored } = inMemory();

    await runs.enqueue(ORDER);
    const first = stored.get('run_1');
    await runs.enqueue({
      ...ORDER,
      placement: { image: null, labelGroups: [] },
    });

    expect(stored.get('run_1')).toBe(first);
  });

  it('refuses another order under a run id that is already ordered', async () => {
    const { runs } = inMemory();

    await runs.enqueue(ORDER);

    await expect(runs.enqueue({ ...ORDER, priority: 5 })).rejects.toThrow(
      RunOrderConflictError,
    );
  });

  it('creates a refused order as a run that ended at once', async () => {
    const { runs, stored } = inMemory();

    await runs.enqueue({
      ...ORDER,
      refusal: [{ description: 'The catalog denies the tool.' }],
    });

    expect(stored.get('run_1')?.state).toBe('failed');
  });

  it('cancels a queued run and says what it was', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);

    expect(await runs.cancel(RunId.of('run_1'), 'Moved on.')).toEqual({
      was: 'queued',
      started: false,
    });
    expect(stored.get('run_1')?.state).toBe('cancelled');
    expect(await runs.cancel(RunId.of('run_9'), 'Moved on.')).toEqual({
      was: 'unknown',
      started: false,
    });
  });

  it('cancels only a run still on the queue when asked to', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);
    stored.set(
      'run_1',
      (stored.get('run_1') as Run).claim(claimer(RunnerId.of('runner_1')), NOW),
    );

    expect(await runs.cancelIfQueued(RunId.of('run_1'), 'Too late.')).toEqual({
      outcome: 'claimed',
    });
    expect(stored.get('run_1')?.state).toBe('claimed');
  });

  it('records a stop request on a claimed run', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);
    stored.set(
      'run_1',
      (stored.get('run_1') as Run).claim(claimer(RunnerId.of('runner_1')), NOW),
    );

    await runs.requestStop(RunId.of('run_1'));

    expect(stored.get('run_1')?.stopRequestedAt).toEqual(NOW);
  });

  it('answers from the cancel that saved when a runner claims the run first', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);
    const queued = stored.get('run_1') as Run;
    const claimed = queued.claim(claimer(RunnerId.of('runner_1')), NOW);
    let reads = 0;
    const racing = new Runs(
      {
        findById: async () => (reads++ === 0 ? queued : claimed),
        save: async (run: Run) => {
          if (run.state === 'cancelled') {
            throw new RunVersionConflictError(run.id.value);
          }
          stored.set(run.id.value, run);
        },
      } as unknown as RunRepository,
      { sha256: (text) => text },
      { now: () => NOW, sleep: async () => {} },
    );

    expect(await racing.cancel(RunId.of('run_1'), 'Moved on.')).toEqual({
      was: 'claimed',
      started: false,
    });
    expect(stored.get('run_1')?.stopRequested).toBe(true);
  });

  it('answers claimed when a runner claims a run cancelled only while queued', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);
    const queued = stored.get('run_1') as Run;
    const claimed = queued.claim(claimer(RunnerId.of('runner_1')), NOW);
    let reads = 0;
    const racing = new Runs(
      {
        findById: async () => (reads++ === 0 ? queued : claimed),
        save: async (run: Run) => {
          throw new RunVersionConflictError(run.id.value);
        },
      } as unknown as RunRepository,
      { sha256: (text) => text },
      { now: () => NOW, sleep: async () => {} },
    );

    expect(await racing.cancelIfQueued(RunId.of('run_1'), 'Stopped.')).toEqual({
      outcome: 'claimed',
    });
  });
});
