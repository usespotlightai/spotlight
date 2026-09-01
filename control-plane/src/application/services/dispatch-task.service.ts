import {
  RunSpecContract,
  type RunSpecShape,
  THROUGH_SPOTLIGHT,
  TRACE_PARENT_VAR,
} from '@application/contracts/run-spec.contract';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TraceParentPort } from '@application/ports/trace-parent.port';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import { orderFor, type RunOrder } from '@domain/services/run-order';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';

/** Named as Spotlight serves it: no host address ever reaches a runner. */
const written = (order: RunOrder, naming: string): RunSpecShape =>
  RunSpecContract.of({
    checkouts: order.repository
      ? [
          {
            remote: THROUGH_SPOTLIGHT,
            path: order.repository.name,
            branch: order.branch,
          },
        ]
      : undefined,
    command: order.harness.command.started({ [TRACE_PARENT_VAR]: naming }),
    briefing: order.briefing,
    handover: { options: order.options, noteLimit: order.noteLimit },
    continuity: order.continuity.told(),
  });

export class DispatchTask implements TaskDispatching {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly harnesses: HarnessRepository,
    private readonly tracing: TraceParentPort,
  ) {}

  async dispatch({
    task,
    line,
  }: {
    task: Task;
    line: AssemblyLine;
  }): Promise<RunId | null> {
    const order = orderFor({ task, line, harnesses: this.harnesses });

    if (!order) {
      return null;
    }

    // Named before it is written down: the spec has to say which run it is for.
    const id = RunIdOf.of(this.ids.generate());

    const queued = Run.enqueue({
      id,
      workspaceId: task.workspaceId,
      harness: order.harness.id,
      priority: order.priority,
      taskId: task.id,
      stationId: order.stationId,
      targetRunner: order.pinnedTo,
      spec: RunSpec.of(written(order, this.tracing.for(task.id, id))),
    });

    await this.runs.add(queued);

    return queued.id;
  }
}
