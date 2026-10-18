import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TurnAwaitsPersonHandler } from '@work/application/queries/handlers/turn-awaits-person.handler';
import { TurnAwaitsPersonQuery } from '@work/application/queries/turn-awaits-person.query';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const claimed = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject: RunSubject.task(
      TaskId.of('task_1'),
      StationId.of('station_1'),
      TaskRevision.of(0),
    ),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: { key: 'task_1:station_1' },
    }),
  }).claim(RUNNER, NOW);

const handlerFor = (run: Run, task: Task | null = null) =>
  new TurnAwaitsPersonHandler(
    { findById: async () => run } as unknown as RunRepository,
    { find: async () => task } as unknown as TaskRepository,
    { findByStation: async () => null } as unknown as LineRepository,
    {
      listens: async () => true,
      before: async () => ({ kind: 'allowed' }),
      after: async () => {},
    },
  );

const query = (runnerId = 'runner_1') =>
  new TurnAwaitsPersonQuery('run_1', runnerId, 0, false, false, {
    next: 'review',
  });

describe('TurnAwaitsPersonHandler', () => {
  it('says a turn of a run working no task never waits for a person', async () => {
    await expect(handlerFor(claimed()).execute(query())).resolves.toBe(false);
  });

  it('says a repeated report of a pause still waits', async () => {
    const waiting = claimed().paused(
      RUNNER,
      RunOutcome.of({ exitCode: 0, failed: false }),
      HandoverReport.none(),
      NOW,
    );

    await expect(handlerFor(waiting).execute(query())).resolves.toBe(true);
  });

  it('rejects a runner that does not lease the run', async () => {
    await expect(
      handlerFor(claimed()).execute(query('runner_2')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
