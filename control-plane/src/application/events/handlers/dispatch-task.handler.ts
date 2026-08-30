import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { RunRepository } from '@domain/repositories/run.repository';
import { TaskBriefing } from '@domain/services/task-briefing';
import { harnessNamed } from '@domain/value-objects/built-in-harnesses';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@domain/value-objects/run-id.vo';

export class DispatchTask implements TaskDispatchPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async dispatch({
    task,
    line,
  }: {
    task: Task;
    line: AssemblyLine;
  }): Promise<RunId | null> {
    const station = line.stationAt(task.stationId);

    if (!station?.harness) {
      return null;
    }

    // Queueing for a harness nothing can start would strand the task on the
    // queue rather than at the station, where a person can see it.
    const harness = harnessNamed(station.harness);
    if (!harness) {
      return null;
    }

    const continuity = task.continuity();

    const queued = Run.enqueue({
      id: RunIdOf.of(this.ids.generate()),
      workspaceId: task.workspaceId,
      harness: harness.id,
      priority: station.position,
      taskId: task.id,
      targetRunner: continuity.pinnedTo,
      spec: {
        command: harness.command.started(),
        briefing: TaskBriefing.brief({ task, line }),
        handover: { options: line.optionsFrom(station.id) },
        continuity: continuity.told(),
      },
    });

    await this.runs.add(queued);

    return queued.id;
  }
}
