import type { DecisionGeneratorPort } from '@change-review/application/ports/decision-generator.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { RequestDecisions } from '@change-review/application/services/request-decisions.service';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-21T10:00:00Z');

const RUN_ORDERED_AT = new Date('2026-09-01T00:00:00.000Z');
const TASK = TaskId.of('task_1');
const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const FIRST_TURN = AgentTurn.of(RUN, 1, RUN_ORDERED_AT);
const SECOND_TURN = AgentTurn.of(RUN, 2, RUN_ORDERED_AT);

const requesting = (
  over: {
    run?: Partial<RunForReview>;
    task?: Partial<ReviewedTask>;
    existing?: DecisionSet | null;
    available?: boolean;
  } = {},
) => {
  let stored: DecisionSet | null = over.existing ?? null;

  const work = {
    run: async (): Promise<RunForReview> => ({
      id: RUN,
      workspaceId: WORKSPACE,
      taskId: TASK,
      checking: null,
      working: false,
      attempt: 1,
      orderedAt: RUN_ORDERED_AT,
      decisions: true,
      trial: false,
      isolated: false,
      checkouts: 1,
      placement: RunnerPlacement.anywhere(),
      ...over.run,
    }),
    task: async (): Promise<ReviewedTask> => ({
      id: TASK,
      workspaceId: WORKSPACE,
      teamId: null,
      pullRequests: [],
      openPullRequests: [],
      reviewedPullRequest: null,
      reviewing: false,
      currentRunId: RUN,
      ...over.task,
    }),
  } as unknown as WorkPort;

  const sets = {
    forTask: async () => stored,
    add: async (set: DecisionSet) => {
      stored = set;
    },
    save: async (set: DecisionSet) => {
      stored = set;
    },
  } as unknown as DecisionSetRepository;

  const service = new RequestDecisions(
    work,
    sets,
    {
      availableTo: async () => over.available ?? true,
    } as unknown as DecisionGeneratorPort,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'set_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return { service, stored: () => stored };
};

describe('requesting the decisions a run made', () => {
  it('opens a set for the task and generates decisions for the run', async () => {
    const { service, stored } = requesting();

    await service.runEnded(TASK, RUN, true);

    expect(stored()?.taskId.equals(TASK)).toBe(true);
    expect(stored()?.generation?.isFor(FIRST_TURN)).toBe(true);
  });

  it('generates nothing for a run or a turn that hands nothing over', async () => {
    const { service, stored } = requesting();

    await service.runEnded(TASK, RUN, false);

    expect(stored()).toBeNull();
  });

  it('generates decisions for a later run into the set the task already has', async () => {
    const existing = DecisionSet.open({
      id: DecisionSetId.of('set_0'),
      taskId: TASK,
      workspaceId: WORKSPACE,
    });
    const { service, stored } = requesting({ existing });

    await service.runEnded(TASK, RUN, true);

    expect(stored()?.id.value).toBe('set_0');
    expect(stored()?.generation?.isFor(FIRST_TURN)).toBe(true);
  });

  it.each([
    ['its station records none', { run: { decisions: false } }],
    [
      'the task reviews a pull request opened elsewhere',
      { task: { reviewing: true } },
    ],
    ['no model is there to generate them', { available: false }],
  ])('requests none where %s', async (_, over) => {
    const { service, stored } = requesting(over);

    await service.runEnded(TASK, RUN, true);

    expect(stored()).toBeNull();
  });
});

describe('requesting the decisions of a kept turn', () => {
  const waiting = { run: { working: false, attempt: 2 } };

  it('generates decisions while the run waits for its person', async () => {
    const { service, stored } = requesting(waiting);

    await service.turnAwaited(TASK, RUN, 2, true);

    expect(stored()?.generation?.isFor(SECOND_TURN)).toBe(true);
  });

  it('generates nothing for a run or a turn that hands nothing over', async () => {
    const { service, stored } = requesting(waiting);

    await service.turnAwaited(TASK, RUN, 2, false);

    expect(stored()).toBeNull();
  });

  it('generates decisions again for the next turn of the same run', async () => {
    const existing = DecisionSet.open({
      id: DecisionSetId.of('set_0'),
      taskId: TASK,
      workspaceId: WORKSPACE,
    }).requestGeneration(FIRST_TURN, NOW);
    const { service, stored } = requesting({ ...waiting, existing });

    await service.turnAwaited(TASK, RUN, 2, true);

    expect(stored()?.generation?.isFor(SECOND_TURN)).toBe(true);
  });

  it('asks for nothing new when the run ends after the turn it already generated for', async () => {
    const existing = DecisionSet.open({
      id: DecisionSetId.of('set_0'),
      taskId: TASK,
      workspaceId: WORKSPACE,
    }).requestGeneration(SECOND_TURN, NOW);
    const { service, stored } = requesting({
      run: { attempt: 2 },
      existing,
    });

    await service.runEnded(TASK, RUN, true);

    expect(stored()).toBe(existing);
  });

  it('leaves the decisions of a later run alone when an earlier run’s turn arrives late', async () => {
    const existing = DecisionSet.open({
      id: DecisionSetId.of('set_0'),
      taskId: TASK,
      workspaceId: WORKSPACE,
    }).requestGeneration(
      AgentTurn.of(RunId.of('run_2'), 1, new Date('2026-09-02T00:00:00.000Z')),
      NOW,
    );
    const { service, stored } = requesting({ ...waiting, existing });

    await service.turnAwaited(TASK, RUN, 2, true);
    await service.runEnded(TASK, RUN, true);

    expect(stored()).toBe(existing);
  });

  it('requests none for a run with no order', async () => {
    const { service, stored } = requesting({ run: { orderedAt: null } });

    await service.runEnded(TASK, RUN, true);

    expect(stored()).toBeNull();
  });

  it('requests none where its station records none', async () => {
    const { service, stored } = requesting({
      run: { ...waiting.run, decisions: false },
    });

    await service.turnAwaited(TASK, RUN, 2, true);

    expect(stored()).toBeNull();
  });
});
