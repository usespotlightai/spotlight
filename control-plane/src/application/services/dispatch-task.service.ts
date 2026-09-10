import {
  RunSpecContract,
  type RunSpecShape,
  THROUGH_SPOTLIGHT,
  TRACE_PARENT_VAR,
} from '@application/contracts/run-spec.contract';
import type { HarnessLaunchPort } from '@application/ports/harness-launch.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TraceParentPort } from '@application/ports/trace-parent.port';
import { TaskBriefing } from '@application/rendering/task-briefing';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import { orderFor, type RunOrder } from '@domain/services/run-order';
import type { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';

/** Named as Spotlight serves it: no host address ever reaches a runner. */
const written = (
  order: RunOrder,
  command: HarnessCommand,
  briefing: string,
  naming: string,
): RunSpecShape =>
  RunSpecContract.of({
    checkouts: order.repositories.map((repository) => ({
      remote: THROUGH_SPOTLIGHT,
      path: repository.name,
      branch: order.branch,
    })),
    command: command.started({ [TRACE_PARENT_VAR]: naming }),
    briefing,
    handover: { options: order.options, noteLimit: order.noteLimit },
    continuity: order.continuity.told(),
    tools: order.tools,
  });

export class DispatchTask implements TaskDispatching {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly harnesses: HarnessRepository,
    private readonly launch: HarnessLaunchPort,
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

    const command = this.launch.commandFor(order.harness.id, {
      model: order.model,
      effort: order.effort,
    });

    if (!command) {
      return null;
    }

    // Named before it is written down: the spec has to say which run it is for.
    const id = RunIdOf.of(this.ids.generate());

    const briefing = TaskBriefing.brief({ task, line });

    const queued = Run.enqueue({
      id,
      workspaceId: task.workspaceId,
      harness: order.harness.id,
      priority: order.priority,
      taskId: task.id,
      stationId: order.stationId,
      targetRunner: order.pinnedTo,
      spec: RunSpec.of(
        written(order, command, briefing, this.tracing.for(task.id, id)),
      ),
    });

    await this.runs.add(queued);

    return queued.id;
  }
}
