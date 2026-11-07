import type { RunsPort } from '@runs/application/ports/runs.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';

export class CancelDetachedRun {
  constructor(private readonly runs: RunsPort) {}

  async on(event: TaskRunDetached): Promise<void> {
    await this.cancel(event.runId);
  }

  async onChatDeleted(event: ChatDeleted): Promise<void> {
    if (event.runId) {
      await this.cancel(event.runId);
    }
  }

  private async cancel(runId: RunId): Promise<void> {
    await this.runs.cancel(runId);
  }
}
