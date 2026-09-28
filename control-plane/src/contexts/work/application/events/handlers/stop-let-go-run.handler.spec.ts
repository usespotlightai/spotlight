import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { StopLetGoRun } from '@work/application/events/handlers/stop-let-go-run.handler';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const queued = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: ['--acp'] },
      briefing: 'work out what is being asked for',
      handover: { options: ['Spec'], noteLimit: 4_000 },
      continuity: { key: 'task_1-station_1' },
    }),
    subject: RunSubject.task(
      TaskId.of('task_1'),
      StationId.of('station_1'),
      TaskRevision.of(0),
    ),
  });

const claimed = () => queued().claim(RUNNER, NOW);

const letGo = new TaskLetGoOfRun(
  TaskId.of('task_1'),
  WorkspaceId.of('ws_1'),
  RunId.of('run_1'),
);

const stopping = (run: Run | null) => {
  const save = vi.fn(async (_: Run) => {});
  const handler = new StopLetGoRun(
    { findById: async () => run, save } as unknown as RunRepository,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save };
};

describe('StopLetGoRun', () => {
  it('asks the run its task let go of to stop', async () => {
    const { handler, save } = stopping(claimed());

    await handler.on(letGo);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].stopRequestedAt).toEqual(NOW);
  });

  it('withdraws a run still waiting on the queue', async () => {
    const { handler, save } = stopping(queued());

    await handler.on(letGo);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].state).toBe('superseded');
  });

  it('leaves a run that has already ended', async () => {
    const { handler, save } = stopping(
      claimed().complete(RUNNER, RunOutcome.of({ exitCode: 0, failed: false })),
    );

    await handler.on(letGo);

    expect(save).not.toHaveBeenCalled();
  });

  it('leaves a run that is no longer there', async () => {
    const { handler, save } = stopping(null);

    await handler.on(letGo);

    expect(save).not.toHaveBeenCalled();
  });
});
