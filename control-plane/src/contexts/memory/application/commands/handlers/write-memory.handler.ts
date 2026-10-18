import type { WriteMemoryCommand } from '@memory/application/commands/write-memory.command';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class WriteMemoryHandler
  implements CommandHandlerPort<WriteMemoryCommand, TeamMemoryDetailDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly loader: TeamMemoryLoader,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: WriteMemoryCommand): Promise<TeamMemoryDetailDto> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.viewerId,
      );
      const layout = await this.loader.layoutOf(access);
      const written = Memory.write({
        id: MemoryId.of(this.ids.generate()),
        handle: await this.memories.nextHandle(),
        workspaceId: access.workspaceId,
        kind: parseMemoryKind(command.writing.kind),
        body: MemoryBody.of(command.writing.body),
        scope: layout.scopeOf(command.writing),
        provenance: null,
        by: MemoryDecision.of({ by: access.by, at: this.clock.now() }),
      });

      await this.memories.add(written);

      return await this.views.detail(written);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
