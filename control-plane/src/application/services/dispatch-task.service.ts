import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { RunRepository } from '@domain/repositories/run.repository';
import { orderFor } from '@domain/services/run-order';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';

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
    const order = orderFor({ task, line });

    if (!order) {
      return null;
    }

    const queued = Run.enqueue({
      id: RunIdOf.of(this.ids.generate()),
      workspaceId: task.workspaceId,
      harness: order.harness,
      priority: order.priority,
      taskId: task.id,
      stationId: order.stationId,
      targetRunner: order.pinnedTo,
      spec: RunSpec.of(order.spec),
    });

    await this.runs.add(queued);

    return queued.id;
  }
}
