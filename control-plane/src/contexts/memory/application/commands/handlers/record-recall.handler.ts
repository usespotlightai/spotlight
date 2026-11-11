import type { RecordRecallCommand } from '@memory/application/commands/record-recall.command';
import type { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import {
  recallableBy,
  recordsRecall,
} from '@memory/domain/services/recall-policy';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RecordRecallHandler implements CommandHandlerPort<
  RecordRecallCommand,
  void
> {
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly memories: MemoryRepository,
    private readonly recording: RecordMemoryUses,
  ) {}

  async execute(command: RecordRecallCommand): Promise<void> {
    try {
      const run = await this.loader.recalling(
        RunId.of(command.runId),
        RunnerId.of(command.runnerId),
      );

      if (!recordsRecall(run)) {
        return;
      }

      const recalled = (
        await this.memories.findAll(
          command.memories.map((each) => MemoryId.of(each)),
        )
      ).filter((each) => recallableBy(each, run));

      await this.recording.recorded(
        run,
        'recalled',
        recalled.map((each) => each.id),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
