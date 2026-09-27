import type { WriteMemoryCommand } from '@memory/application/commands/write-memory.command';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class WriteMemoryHandler
  implements CommandHandlerPort<WriteMemoryCommand, TeamMemoryDetailDto>
{
  constructor(
    private readonly atHand: TeamMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: WriteMemoryCommand): Promise<TeamMemoryDetailDto> {
    try {
      const member = await this.atHand.member(command.teamId, command.viewerId);
      const layout = await this.atHand.layoutOf(command.teamId);
      const written = Memory.written({
        id: MemoryId.of(this.ids.generate()),
        handle: await this.memories.nextHandle(),
        workspaceId: member.workspaceId,
        kind: command.writing.kind,
        body: command.writing.body,
        scope: layout.scopeOf(command.writing),
        grounds: null,
        supersedes: null,
        by: MemoryDecision.of({ by: member.by, at: this.clock.now() }),
      });

      await this.memories.add(written);

      return await this.views.detail(written);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
