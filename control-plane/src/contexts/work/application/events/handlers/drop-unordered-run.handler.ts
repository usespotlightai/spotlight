import type { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class DropUnorderedRun {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly chats: ChatRepository,
  ) {}

  async ofTask(event: DispatchRefused): Promise<void> {
    const task = event.taskId ? await this.tasks.find(event.taskId) : null;

    if (task?.hasCurrentRun(event.runId)) {
      await this.tasks.save(task.dropUnstartedRun(event.runId));
    }
  }

  async ofChat(event: DispatchRefused): Promise<void> {
    const chat = event.chatId ? await this.chats.find(event.chatId) : null;

    if (chat?.hasCurrentRun(event.runId)) {
      await this.chats.save(chat.runNotStarted(event.runId));
    }
  }
}
