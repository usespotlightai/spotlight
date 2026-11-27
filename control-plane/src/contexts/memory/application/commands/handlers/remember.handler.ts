import type { RememberCommand } from '@memory/application/commands/remember.command';
import type { RunProposing } from '@memory/application/services/run-proposing.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryPredecessor } from '@memory/domain/value-objects/memory-predecessor.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RememberHandler implements CommandHandlerPort<
  RememberCommand,
  string
> {
  constructor(
    private readonly proposing: RunProposing,
    private readonly memories: MemoryRepository,
  ) {}

  async execute(command: RememberCommand): Promise<string> {
    try {
      const input = command.remembering;

      return await this.proposing.proposed(
        command.runId,
        command.runnerId,
        async ({ remembering, teamId, id, at, now }) =>
          remembering.proposalOf({
            id,
            remembered: {
              kind: input.kind,
              body: input.body,
              scope: input.scope,
              paths: input.paths,
              supersedes: await this.superseded(teamId, input.supersedes),
            },
            at,
            now,
          }),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async superseded(
    teamId: TeamId,
    raw: string | null,
  ): Promise<MemoryPredecessor | null> {
    if (raw === null || raw.trim() === '') {
      return null;
    }

    const handle = MemoryHandle.parse(raw);
    const memory = await this.memories.withHandle(teamId, handle);

    if (!memory) {
      throw new UnknownMemoryError(handle.value);
    }

    return memory.asPredecessor;
  }
}
