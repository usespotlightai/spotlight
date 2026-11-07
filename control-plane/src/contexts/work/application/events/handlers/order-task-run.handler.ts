import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { DispatchOrderMapper } from '@work/application/mappers/dispatch-order.mapper';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { DispatchTask } from '@work/application/services/dispatch-task.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { TaskDispatched } from '@work/domain/events/task-dispatched.event';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class OrderTaskRun {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly dispatches: DispatchRepository,
    private readonly dispatching: DispatchTask,
    private readonly clock: ClockPort,
  ) {}

  async on(event: TaskDispatched): Promise<void> {
    const task = await this.tasks.find(event.taskId);

    if (!task?.hasCurrentRun(event.runId)) {
      return;
    }

    if (await this.dispatches.find(event.runId)) {
      return;
    }

    const line = await this.lines.findByStation(task.stationId);
    const ordered = line
      ? await this.dispatching.ordered({ task, line, runId: event.runId })
      : null;
    const ordering = {
      id: event.runId,
      workspaceId: task.workspaceId,
      teamId: line?.teamId ?? null,
      subject: {
        kind: 'task' as const,
        taskId: task.id,
        revision: task.revision,
        stationId: task.stationId,
      },
      configuredAs: ordered?.configuredAs ?? null,
      briefedTask: ordered?.briefedTask ?? null,
      briefing: ordered?.order.spec.briefing ?? null,
      briefedMemories: ordered?.briefedMemories,
      now: this.clock.now(),
    };

    await this.dispatches.add(
      ordered
        ? Dispatch.ordered({
            ...ordering,
            order: DispatchOrderMapper.toDispatchOrder(ordered.order),
          })
        : Dispatch.unorderable(ordering),
    );
  }
}
