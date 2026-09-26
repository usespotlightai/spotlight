import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CompleteRunHandler } from '@work/application/commands/handlers/complete-run.handler';
import { CompleteRunCommand } from '@work/application/commands/runner.commands';
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type {
  BeforeMoment,
  HookVerdict,
} from '@work/application/ports/lifecycle-hooks.port';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const held = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject: RunSubject.task(TaskId.of('task_1'), null, 0),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const HOOKED = { taskId: 'task_1', runId: 'run_1' } as HookedTaskDto;

const completing = (
  save: (run: Run) => Promise<void>,
  verdict: HookVerdict = { kind: 'allowed' },
) => {
  const asked: BeforeMoment[] = [];
  const handler = new CompleteRunHandler(
    { findById: async () => held(), save } as unknown as RunRepository,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
    { of: async () => HOOKED } as unknown as HookedTasksPort,
    {
      listens: async () => true,
      before: async (_task, moment) => {
        asked.push(moment);
        return verdict;
      },
      after: async () => {},
    },
  );

  return Object.assign(handler, { asked });
};

const declaredOn = (run: Run | undefined) =>
  (
    run?.pullEvents().find((each) => each instanceof RunCompleted) as
      | RunCompleted
      | undefined
  )?.declared;

describe('CompleteRunHandler', () => {
  it('keeps whether the run was stopped on what it ended with', async () => {
    const saved: Run[] = [];

    await completing(async (run) => void saved.push(run)).execute(
      new CompleteRunCommand(
        'run_1',
        'runner_1',
        130,
        false,
        undefined,
        null,
        null,
        true,
      ),
    );

    expect(saved[0]?.outcome?.stopped).toBe(true);
  });

  it('reports a run that moved on while it was completing as a conflict', async () => {
    await expect(
      completing(async (run) => {
        throw new RunMovedOnError(run.id.value);
      }).execute(new CompleteRunCommand('run_1', 'runner_1', 0, false)),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  describe('handing over', () => {
    const handingOver = (next: string) =>
      new CompleteRunCommand('run_1', 'runner_1', 0, false, undefined, {
        next,
        note: 'Ready for review.',
      });

    it('asks the hooks before the task is handed over, saying where and what', async () => {
      const saved: Run[] = [];
      const handler = completing(async (run) => void saved.push(run));

      await handler.execute(handingOver('review-code'));

      expect(handler.asked).toEqual([
        { on: 'handover.giving', to: 'review-code', note: 'Ready for review.' },
      ]);
      expect(declaredOn(saved[0])?.next).toBe('review-code');
    });

    it('says nowhere where the run named no station', async () => {
      const handler = completing(async () => {});

      await handler.execute(handingOver(''));

      expect(handler.asked[0]).toMatchObject({ to: null });
    });

    it('puts the task to a person with the hook’s reason when a hook refuses', async () => {
      const saved: Run[] = [];

      await completing(async (run) => void saved.push(run), {
        kind: 'refused',
        reason: 'The hook core/qa refused: tests are red.',
      }).execute(handingOver('deploy'));

      const declared = declaredOn(saved[0]);
      expect(declared?.asksForReview()).toBe(true);
      expect(declared?.note).toBe(
        'The hook core/qa refused: tests are red.\n\nThe run said: Ready for review.',
      );
    });

    it('asks no hooks when the run failed or was stopped', async () => {
      const failed = completing(async () => {});
      await failed.execute(
        new CompleteRunCommand('run_1', 'runner_1', 1, true, 'boom', {
          next: 'deploy',
        }),
      );

      const stopped = completing(async () => {});
      await stopped.execute(
        new CompleteRunCommand(
          'run_1',
          'runner_1',
          130,
          false,
          undefined,
          { next: 'deploy' },
          null,
          true,
        ),
      );

      expect(failed.asked).toEqual([]);
      expect(stopped.asked).toEqual([]);
    });

    it('asks no hooks when the run declared nothing', async () => {
      const handler = completing(async () => {});

      await handler.execute(
        new CompleteRunCommand('run_1', 'runner_1', 0, false),
      );

      expect(handler.asked).toEqual([]);
    });

    it('asks no hooks for a run another runner holds', async () => {
      const handler = completing(async () => {});

      await expect(
        handler.execute(
          new CompleteRunCommand('run_1', 'runner_2', 0, false, undefined, {
            next: 'deploy',
          }),
        ),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(handler.asked).toEqual([]);
    });
  });
});
