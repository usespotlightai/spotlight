import type { RecordDeliveryCommand } from '@memory/application/commands/record-delivery.command';
import type { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import {
  recallableBy,
  recordsRecall,
} from '@memory/domain/services/recall-policy';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RecordDeliveryHandler implements CommandHandlerPort<
  RecordDeliveryCommand,
  void
> {
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly memories: MemoryRepository,
    private readonly recording: RecordMemoryUses,
  ) {}

  async execute(command: RecordDeliveryCommand): Promise<void> {
    try {
      const handles = command.handles.map((each) => MemoryHandle.parse(each));
      const run = await this.loader.recalling(
        RunId.of(command.runId),
        RunnerId.of(command.runnerId),
      );

      if (!recordsRecall(run)) {
        return;
      }

      const delivered = (
        await Promise.all(
          handles.map((each) => this.memories.withHandle(run.teamId, each)),
        )
      ).filter(
        (each): each is Memory => each !== null && recallableBy(each, run),
      );

      await this.recording.recorded(
        run,
        'delivered',
        delivered.map((each) => each.id),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
