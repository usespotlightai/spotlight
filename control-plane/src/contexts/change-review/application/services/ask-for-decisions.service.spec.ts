import type { DecisionDrafterPort } from '@change-review/application/ports/decision-drafter.port';
import type {
  ReviewedRun,
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { AskForDecisions } from '@change-review/application/services/ask-for-decisions.service';
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

const asking = (
  over: {
    run?: Partial<ReviewedRun>;
    task?: Partial<ReviewedTask>;
    held?: DecisionSet | null;
    available?: boolean;
  } = {},
) => {
  let stored: DecisionSet | null = over.held ?? null;

  const work = {
    run: async (): Promise<ReviewedRun> => ({
      id: RUN,
      workspaceId: WORKSPACE,
      taskId: TASK,
      checking: null,
      ended: true,
      completed: true,
      decisions: true,
      replay: false,
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

  const service = new AskForDecisions(
    work,
    sets,
    { available: over.available ?? true } as DecisionDrafterPort,
    { run: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'set_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return { service, stored: () => stored };
};

describe('asking for the decisions a run made', () => {
  it('opens a set for the task and drafts the run', async () => {
    const { service, stored } = asking();

    await service.runEnded(TASK, RUN);

    expect(stored()?.taskId.equals(TASK)).toBe(true);
    expect(stored()?.draft?.isFor(RUN)).toBe(true);
  });

  it('drafts a later run into the set the task already holds', async () => {
    const held = DecisionSet.opened({
      id: DecisionSetId.of('set_0'),
      taskId: TASK,
      workspaceId: WORKSPACE,
    });
    const { service, stored } = asking({ held });

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
  ])('asks for none where %s', async (_, over) => {
    const { service, stored } = asking(over);

    await service.runEnded(TASK, RUN);

    expect(stored()).toBeNull();
  });
});
