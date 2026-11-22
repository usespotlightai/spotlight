import type { TeamWindow } from '@insights/application/ports/insights-reader.port';
import type {
  MemoryUsePort,
  MemoryView,
  TeamMemoryUseView,
} from '@insights/application/ports/memory-use.port';
import type { TeamMemoryUsePort } from '@memory/application/ports/team-memory-use.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

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
      activeCount: use.activeCount,
      flagged: use.flagged.map((each) => ({ ...each })),
    };
  }

  async described(
    workspaceId: WorkspaceId,
    memories: readonly string[],
  ): Promise<ReadonlyMap<string, MemoryView>> {
    const found = await this.memory.described(workspaceId.value, memories);

    return new Map(found.map((each) => [each.memoryId, { ...each }]));
  }
}
