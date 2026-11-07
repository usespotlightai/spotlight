import type { RunFactsMaintenance } from '@insights/application/services/project-run-facts.service';

export interface RebuiltRunFacts {
  readonly owner: string;
  readonly rebuilt: number;
}

export class RebuildRunFacts {
  constructor(private readonly facts: RunFactsMaintenance) {}

  async ofTeam(workspaceId: string, teamId: string): Promise<RebuiltRunFacts> {
    return {
      owner: `team ${teamId}`,
      rebuilt: await this.facts.rebuild({ kind: 'team', workspaceId, teamId }),
    };
  }

  async ofWorkspaces(
    workspaceIds: readonly string[] | null,
    rebuilt: (each: RebuiltRunFacts) => void,
  ): Promise<void> {
    for (const workspaceId of workspaceIds ?? (await this.facts.workspaces())) {
      rebuilt({
        owner: `workspace ${workspaceId}`,
        rebuilt: await this.facts.rebuild({ kind: 'workspace', workspaceId }),
      });
    }
  }
}
