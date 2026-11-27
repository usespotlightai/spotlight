import { RecordRunDecisionsHandler } from '@change-review/application/commands/handlers/record-run-decisions.handler';
import {
  type DecisionInput,
  RecordRunDecisionsCommand,
} from '@change-review/application/commands/record-run-decisions.command';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import type { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { DecisionSetVersionConflictError } from '@change-review/domain/exceptions/decision-set-version-conflict.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import type {
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = 'run_1';
const TASK = TaskId.of('task_1');

const DECISION: DecisionInput = {
  kind: 'trade-off',
  title: 'Retries uploads in the request',
  why: 'A queue would need a worker the service does not run yet.',
  alternatives: ['Retry from a queue'],
  paths: ['api/src/uploads.ts'],
};

const recording = (
  over: {
    leased?: boolean;
    run?: Partial<RunForReview>;
    task?: Partial<ReviewedTask>;
    conflicts?: number;
  } = {},
) => {
  let stored: DecisionSet | null = null;
  let conflicts = over.conflicts ?? 0;
  let next = 0;

  const work = {
    run: async (): Promise<RunForReview> => ({
      id: RunId.of(RUN),
      workspaceId: WorkspaceId.of('ws_1'),
      taskId: TASK,
      checking: null,
      working: true,
      attempt: 1,
      orderedAt: null,
      decisions: true,
      trial: false,
      isolated: false,
      checkouts: 1,
      placement: RunnerPlacement.anywhere(),
      ...over.run,
    }),
    teamOfRun: async () => null,
    task: async (): Promise<ReviewedTask> => ({
      id: TASK,
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: null,
      pullRequests: [],
      openPullRequests: [],
      reviewedPullRequest: null,
      reviewing: false,
      currentRunId: RunId.of(RUN),
      ...over.task,
    }),
    taskWithPullRequest: async () => null,
    repositoriesOfRun: async () => [],
  } satisfies WorkPort;

  const write = async (set: DecisionSet) => {
    if (conflicts > 0) {
      conflicts -= 1;
      throw new DecisionSetVersionConflictError(set.id.value);
    }
    stored = set;
  };
  const sets = {
    forTask: async () => stored,
    add: write,
    save: write,
    remove: async () => {},
  } satisfies DecisionSetRepository;

  return {
    handler: new RecordRunDecisionsHandler(
      work,
      partial<RunLeasesPort>({
        leasedBy: async () =>
          over.leased === false ? null : partial<LeasedRunFacts>({}),
      }),
      sets,
      { inTransaction: (work) => work() },
      { generate: () => `id_${(next += 1)}` },
    ),
    stored: (): DecisionSet | null => stored,
  };
};

const sent = (decisions: readonly DecisionInput[]) =>
  new RecordRunDecisionsCommand(RUN, 'runner_1', decisions);

describe('recording the decisions of a run', () => {
  it('records the agent’s decisions on the run’s task, each with the run and no steps', async () => {
    const { handler, stored } = recording();

    const recorded = await handler.execute(sent([DECISION]));

    expect(recorded).toEqual({ outcome: 'recorded', ids: ['id_1'] });
    expect(stored()?.taskId).toEqual(TASK);
    expect(
      stored()?.decisions.map((each) => [
        each.title,
        each.recordedIn.value,
        each.journalSteps,
      ]),
    ).toEqual([['Retries uploads in the request', RUN, []]]);
  });

  it('answers with the id it kept when the agent records a decision again', async () => {
    const { handler, stored } = recording();
    await handler.execute(sent([DECISION]));

    const again = await handler.execute(
      sent([DECISION, { ...DECISION, title: 'Second' }]),
    );

    expect(again).toEqual({ outcome: 'recorded', ids: ['id_1', 'id_4'] });
    expect(stored()?.decisions).toHaveLength(2);
  });

  it('tries once more when another call recorded at the same time', async () => {
    const { handler, stored } = recording({ conflicts: 1 });

    await handler.execute(sent([DECISION]));

    expect(stored()?.decisions).toHaveLength(1);
  });

  it('names the path of each decision that breaks a rule', async () => {
    const { handler, stored } = recording();

    const recorded = await handler.execute(
      sent([
        DECISION,
        { ...DECISION, kind: 'opinion' },
        { ...DECISION, paths: [] },
        { ...DECISION, title: ' ' },
      ]),
    );

    expect(recorded.outcome).toBe('invalid');
    expect(
      recorded.outcome === 'invalid'
        ? recorded.problems.map((each) => each.field.rendered)
        : [],
    ).toEqual([
      'decisions[1].kind',
      'decisions[2].paths',
      'decisions[3].title',
    ]);
    expect(stored()).toBeNull();
  });

  it('takes between one and twenty decisions at once', async () => {
    const { handler } = recording();

    for (const decisions of [
      [],
      Array.from({ length: 21 }, (_, at) => ({
        ...DECISION,
        title: `Decision ${at}`,
      })),
    ]) {
      const recorded = await handler.execute(sent(decisions));
      expect(
        recorded.outcome === 'invalid'
          ? recorded.problems.map((each) => each.field.rendered)
          : [],
      ).toEqual(['decisions']);
    }
  });

  it('refuses a run of a station that keeps no decisions', async () => {
    const { handler } = recording({ run: { decisions: false } });

    const refused = handler.execute(sent([DECISION]));

    await expect(refused).rejects.toMatchObject({ kind: 'conflict' });
    await expect(refused).rejects.toThrow(/keeps no decisions/);
  });

  it('refuses a run of no task, a trial, or a task that reviews a pull request', async () => {
    for (const over of [
      { run: { taskId: null } },
      { run: { trial: true } },
      { task: { reviewing: true } },
    ]) {
      await expect(
        recording(over).handler.execute(sent([DECISION])),
      ).rejects.toMatchObject({ kind: 'conflict' });
    }
  });

  it('knows no run this runner does not lease', async () => {
    const { handler } = recording({ leased: false });

    await expect(handler.execute(sent([DECISION]))).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
