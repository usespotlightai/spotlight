import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { RunRepository } from '@domain/repositories/run.repository';
import { TaskBriefing } from '@domain/services/task-briefing';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@domain/value-objects/run-id.vo';

const AGENT = 'claude';

export class DispatchTask implements TaskDispatchPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async dispatch({
    task,
    station,
  }: {
    task: Task;
    station: Station;
  }): Promise<RunId | null> {
    if (!station.pool) {
      return null;
    }

    const queued = Run.enqueue({
      id: RunIdOf.of(this.ids.generate()),
      workspaceId: task.workspaceId,
      pool: station.pool.value,
      priority: station.position,
      taskId: task.id,
      spec: {
        command: {
          executable: AGENT,
          args: ['-p', TaskBriefing.brief(station, task)],
        },
      },
    });

    await this.runs.add(queued);

    return queued.id;
  }
}
