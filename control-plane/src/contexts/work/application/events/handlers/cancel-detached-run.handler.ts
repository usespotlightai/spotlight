import type { RunsPort } from '@runs/application/ports/runs.port';
import type { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';

export class CancelDetachedRun {
  constructor(private readonly runs: RunsPort) {}

  async on(event: TaskRunDetached): Promise<void> {
    await this.runs.cancel(
      event.runId,
      'Task moved on before a runner claimed the run.',
    );
  }

  async onChatDeleted(event: ChatDeleted): Promise<void> {
    if (event.runId) {
      await this.runs.cancel(
        event.runId,
        'Chat was deleted before a runner claimed the run.',
      );
    }
  }
}
