import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { RunRepository } from '@domain/repositories/run.repository';
import { handoverOptions } from '@domain/services/handover-options';
import { harnessNamed } from '@domain/value-objects/built-in-harnesses';
import { TaskBriefing } from '@domain/services/task-briefing';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@domain/value-objects/run-id.vo';

export class DispatchTask implements TaskDispatchPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async dispatch({
    task,
    station,
    stations,
  }: {
    task: Task;
    station: Station;
    stations: readonly Station[];
  }): Promise<RunId | null> {
    if (!station.harness) {
      return null;
    }

    // Queueing for a harness nothing can start would strand the task on the
    // queue rather than at the station, where a person can see it.
    const harness = harnessNamed(station.harness);
    if (!harness) {
      return null;
    }

    const queued = Run.enqueue({
      id: RunIdOf.of(this.ids.generate()),
      workspaceId: task.workspaceId,
      harness: harness.id,
      priority: station.position,
      taskId: task.id,
      spec: {
        command: harness.command.briefedWith(
          TaskBriefing.brief({ station, task, stations }),
        ),
        handover: { options: handoverOptions(stations, station.id) },
      },
    });

    await this.runs.add(queued);

    return queued.id;
  }
}
