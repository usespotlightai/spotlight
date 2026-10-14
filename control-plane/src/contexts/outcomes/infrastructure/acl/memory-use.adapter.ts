import type { TeamMemoryUsePort } from '@memory/application/ports/team-memory-use.port';
import type {
  MemoryUsePort,
  TeamMemoryUseView,
} from '@outcomes/application/ports/memory-use.port';
import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';

export class MemoryUse implements MemoryUsePort {
  constructor(private readonly memory: TeamMemoryUsePort) {}

  async between(window: TeamWindow): Promise<TeamMemoryUseView> {
    const use = await this.memory.between({
      workspaceId: window.workspaceId.value,
      teamId: window.teamId.value,
      from: window.from,
      to: window.to,
    });

    return {
      standing: use.standing,
      flagged: use.flagged.map((each) => ({ ...each })),
    };
  }
}
