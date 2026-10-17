import type { DecisionDrafterPort } from '@change-review/application/ports/decision-drafter.port';
import type {
  ReviewedRun,
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { RequestDecisions } from '@change-review/application/services/request-decisions.service';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-21T10:00:00Z');
const TASK = TaskId.of('task_1');
const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');

const requesting = (
  over: {
    run?: Partial<ReviewedRun>;
    task?: Partial<ReviewedTask>;
    existing?: DecisionSet | null;
    available?: boolean;
  } = {},
) => {
  let stored: DecisionSet | null = over.existing ?? null;

  const work = {
    run: async (): Promise<ReviewedRun> => ({
      id: RUN,
      workspaceId: WORKSPACE,
      taskId: TASK,
      checking: null,
      ended: true,
      completed: true,
      decisions: true,
      isReplay: false,
      isSearch: false,
      ...over.run,
    }),
    task: async (): Promise<ReviewedTask> => ({
      id: TASK,
      workspaceId: WORKSPACE,
      teamId: null,
      pullRequest: null,
      reviewing: false,
      currentRunId: null,
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
    { available: over.available ?? true } as DecisionDrafterPort,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'set_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return { service, stored: () => stored };
};

describe('requesting the decisions a run made', () => {
  it('opens a set for the task and drafts the run', async () => {
    const { service, stored } = requesting();

    await service.runEnded(TASK, RUN);

    expect(stored()?.taskId.equals(TASK)).toBe(true);
    expect(stored()?.draft?.isFor(RUN)).toBe(true);
  });

  it('drafts a later run into the set the task already has', async () => {
    const existing = DecisionSet.open({
      id: DecisionSetId.of('set_0'),
      taskId: TASK,
      workspaceId: WORKSPACE,
    });
    const { service, stored } = requesting({ existing });

    await service.runEnded(TASK, RUN);

    expect(stored()?.id.value).toBe('set_0');
    expect(stored()?.draft?.isFor(RUN)).toBe(true);
  });

  it.each([
    ['its station records none', { run: { decisions: false } }],
    ['the run did not complete', { run: { completed: false } }],
    [
      'the task reviews a pull request opened elsewhere',
      { task: { reviewing: true } },
    ],
    ['no model is there to draft them', { available: false }],
  ])('requests none where %s', async (_, over) => {
    const { service, stored } = requesting(over);

    await service.runEnded(TASK, RUN);

    expect(stored()).toBeNull();
  });
});
