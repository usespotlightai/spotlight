import type { OutboundTaskNotifierPort } from '@application/ports/outbound-task-notifier.port';
import type { Task } from '@domain/aggregates/task.aggregate';
import { isBindableTaskEvent } from '@domain/events/bindable-task-events';
import type { TaskRepository } from '@domain/repositories/task.repository';

export class AnnounceTaskEvents {
  constructor(
    private readonly notifier: OutboundTaskNotifierPort,
    private readonly tasks: TaskRepository,
  ) {}

  async of(task: Task): Promise<void> {
    for (const event of task.pullEvents()) {
      if (!isBindableTaskEvent(event.kind)) {
        continue;
      }

      const kept = await this.notifier.notify(task, event.kind);

      if (kept.length > 0) {
        // Re-read: the announcing save moved the task on, so saving the copy in hand would be stale.
        const held = await this.tasks.find(task.id);

        if (held) {
          await this.tasks.save(
            kept.reduce((held, mark) => held.markedBy(mark), held),
          );
        }
      }
    }
  }
}
