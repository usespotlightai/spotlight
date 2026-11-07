import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class CancelDetachedRun {
  constructor(
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
  ) {}

  async on(event: TaskRunDetached): Promise<void> {
    await this.cancel(event.runId);
  }

  async onChatDeleted(event: ChatDeleted): Promise<void> {
    if (event.runId) {
      await this.cancel(event.runId);
    }
  }

  private async cancel(runId: RunId): Promise<void> {
    const run = await this.runs.findById(runId);
    const cancelled = run?.cancel(this.clock.now());

    if (run && cancelled && cancelled !== run) {
      await this.runs.save(cancelled);
    }
  }
}
