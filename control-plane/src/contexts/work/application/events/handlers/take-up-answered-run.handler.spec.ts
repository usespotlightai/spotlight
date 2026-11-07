import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TakeUpAnsweredRun } from '@work/application/events/handlers/take-up-answered-run.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { Runs } from '@work/application/services/runs.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { orderedFor } from '@work/domain/aggregates/run.fake-spec';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { Sha256ContentHash } from '@work/infrastructure/hashing/sha256-content-hash';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const RUN = RunId.of('run_1');
const RUNNER = RunnerId.of('runner_1');
const TASK = TaskId.of('task_1');

const suspended = () =>
  Run.enqueue({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.task(TASK.value, 0),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    }),
  })
    .claim(RUNNER, NOW)
    .reportTurn(
      RUNNER,
      RunOutcome.of({ exitCode: 0, failed: false }),
      HandoverReport.none(),
      NOW,
    );

const takingUp = (run: Run, takesUp = true) => {
  let current = run;
  const runs = {
    findById: async () => current,
    save: async (saved: Run) => {
      current = saved;
    },
  } as unknown as RunRepository;
  const handler = new TakeUpAnsweredRun(
    {
      find: async () =>
        ({
          takesUp: () => takesUp,
          stationId: StationId.of('station_1'),
        }) as unknown as Task,
    } as unknown as TaskRepository,
    { find: async () => null } as unknown as DispatchRepository,
    { findByStation: async () => null } as unknown as LineMapsPort,
    new Runs(runs, new Sha256ContentHash(), {
      now: () => NOW,
      sleep: async () => {},
    }),
  );

  return { handler, current: () => current };
};

const answered = (turn: AwaitedTurn | null) =>
  new TaskAnswered(TASK, WorkspaceId.of('ws_1'), RUN, turn);

describe('TakeUpAnsweredRun', () => {
  it('resumes the turn an answer was to, even before its task kept it (R7)', async () => {
    const { handler, current } = takingUp(suspended());

    await handler.on(answered(AwaitedTurn.of(RUN, 1)));

    expect(current().state).toBe('queued');
    expect(current().attempt).toBe(2);
    expect(current().keep(1)).toBe(current());
  });

  it('resumes a kept turn on an answer that was to no turn, as before', async () => {
    const { handler, current } = takingUp(suspended().keep(1));

    await handler.on(answered(null));

    expect(current().attempt).toBe(2);
  });

  it('never resumes a turn its task still decides on an answer that was to no turn (R7b)', async () => {
    const run = suspended();
    const { handler, current } = takingUp(run);

    await handler.on(answered(null));

    expect(current()).toBe(run);
  });

  it('resumes nothing for an answer to an older turn (R7c)', async () => {
    const run = suspended().keep(1).resumed(1, 'answered', [], NOW);
    const { handler, current } = takingUp(run);

    await handler.on(answered(AwaitedTurn.of(RUN, 1)));

    expect(current()).toBe(run);
  });

  it('leaves the run alone while its task does not take it up', async () => {
    const run = suspended().keep(1);
    const { handler, current } = takingUp(run, false);

    await handler.on(answered(AwaitedTurn.of(RUN, 1)));

    expect(current()).toBe(run);
  });
});
