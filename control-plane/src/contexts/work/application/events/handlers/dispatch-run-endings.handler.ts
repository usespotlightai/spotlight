import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunEndedFacts } from '@work/application/services/run-ending-reactions';
import type { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { DispatchEnding } from '@work/domain/value-objects/dispatch-ending.vo';

export class DispatchRunEndings {
  constructor(
    private readonly dispatches: DispatchRepository,
    private readonly clock: ClockPort,
  ) {}

  onRunEnded(event: RunEndedIntegrationEvent): Promise<void> {
    return this.ended(RunEndedFacts.runId(event), RunEndedFacts.ending(event));
  }

  onTaskRunDetached(event: TaskRunDetached): Promise<void> {
    return this.detached(event.runId);
  }

  async onChatDeleted(event: ChatDeleted): Promise<void> {
    if (event.runId) {
      await this.detached(event.runId);
    }
  }

  private async ended(runId: RunId, ending: DispatchEnding): Promise<void> {
    const dispatch = await this.dispatches.find(runId);

    if (!dispatch || dispatch.ending) {
      return;
    }

    await this.dispatches.save(dispatch.ended(ending));
  }

  private async detached(runId: RunId): Promise<void> {
    const dispatch = await this.dispatches.find(runId);

    if (!dispatch || dispatch.detachedAt) {
      return;
    }

    await this.dispatches.save(dispatch.detached(this.clock.now()));
  }
}
