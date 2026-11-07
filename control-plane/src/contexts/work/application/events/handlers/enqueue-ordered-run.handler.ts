import type { RunsPort } from '@runs/application/ports/runs.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { DispatchOrderMapper } from '@work/application/mappers/dispatch-order.mapper';
import type { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class EnqueueOrderedRun {
  constructor(
    private readonly dispatches: DispatchRepository,
    private readonly tasks: TaskRepository,
    private readonly chats: ChatRepository,
    private readonly runs: RunsPort,
    private readonly clock: ClockPort,
  ) {}

  async on(event: DispatchOrdered): Promise<void> {
    const dispatch = await this.dispatches.find(event.runId);

    if (!dispatch || dispatch.settled) {
      return;
    }

    if (dispatch.ending) {
      await this.dispatches.save(dispatch.enqueuedAsRun());
      return;
    }

    if (!(await this.stillHeld(dispatch))) {
      await this.runs.cancel(dispatch.id);
      await this.dispatches.save(dispatch.refusedFor('withdrawn'));
      return;
    }

    const order = dispatch.order;

    if (!order) {
      return;
    }

    const enqueueing = await this.runs.enqueue(
      DispatchOrderMapper.toRunOrder(order),
    );

    if (enqueueing.outcome === 'refused') {
      await this.dispatches.save(dispatch.refusedFor('order-refused'));
      return;
    }

    await this.markEnqueued(dispatch.id);
  }

  private async markEnqueued(runId: RunId): Promise<void> {
    const dispatch = await this.dispatches.find(runId);

    if (!dispatch || dispatch.settled) {
      return;
    }

    if (await this.stillHeld(dispatch)) {
      await this.dispatches.save(dispatch.enqueuedAsRun());
      return;
    }

    await this.runs.cancel(runId);
    await this.dispatches.save(
      dispatch.enqueuedAsRun().detached(this.clock.now()),
    );
  }

  private async stillHeld(dispatch: Dispatch): Promise<boolean> {
    const subject = dispatch.subject;

    if (subject.kind === 'task') {
      const task = await this.tasks.find(subject.taskId);

      return task?.hasCurrentRun(dispatch.id) ?? false;
    }

    if (subject.kind === 'chat') {
      const chat = await this.chats.find(subject.chatId);

      return chat?.hasCurrentRun(dispatch.id) ?? false;
    }

    return false;
  }
}
