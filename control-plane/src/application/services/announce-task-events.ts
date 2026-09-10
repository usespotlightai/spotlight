import type { OutboundTaskNotifierPort } from '@application/ports/outbound-task-notifier.port';
import type { Task } from '@domain/aggregates/task.aggregate';
import { isBindableTaskEvent } from '@domain/events/bindable-task-events';
import type { TaskRepository } from '@domain/repositories/task.repository';

/**
 * Where a task's recorded events become word carried out of Spotlight. A
 * handler that has just saved a task hands it here rather than knowing which
 * events a host cares about: this pulls the events, carries each bindable one
 * to the notifier, and records any marks a host wants kept.
 */
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
        // The save that announced this moved the task on, so the marks land on
        // the copy read back, not the one still in hand.
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
