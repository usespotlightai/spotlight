import type { EditMemoryCommand } from '@memory/application/commands/edit-memory.command';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class EditMemoryHandler
  implements CommandHandlerPort<EditMemoryCommand, TeamMemoryDetailDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly atHand: TeamMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: EditMemoryCommand): Promise<TeamMemoryDetailDto> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.viewerId,
      );
      const layout = await this.atHand.layoutOf(clearance);
      const old = await this.atHand.memory(clearance, command.memoryId);
      const successor = old.correctedAs({
        id: MemoryId.of(this.ids.generate()),
        handle: await this.memories.nextHandle(),
        kind: parseMemoryKind(command.writing.kind),
        body: MemoryBody.of(command.writing.body),
        scope: layout.scopeOf(command.writing),
        by: MemoryDecision.of({ by: clearance.by, at: this.clock.now() }),
      });

      await this.memories.add(successor);

      return await this.views.detail(successor);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
