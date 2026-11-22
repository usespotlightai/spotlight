import type { ForgetCommand } from '@memory/application/commands/forget.command';
import type { RunProposing } from '@memory/application/services/run-proposing.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class ForgetHandler implements CommandHandlerPort<
  ForgetCommand,
  string
> {
  constructor(
    private readonly proposing: RunProposing,
    private readonly memories: MemoryRepository,
  ) {}

  async execute(command: ForgetCommand): Promise<string> {
    try {
      const handle = MemoryHandle.parse(command.handle);

      return await this.proposing.proposed(
        command.runId,
        command.runnerId,
        async ({ remembering, teamId, id, at, now }) => {
          const memory = await this.memories.withHandle(teamId, handle);

          if (!memory) {
            throw new UnknownMemoryError(handle.value);
          }

          return remembering.retiringOf({
            id,
            memory,
            because: command.because,
            at,
            now,
          });
        },
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
