import type { ProvidedTools } from '@integrations/application/services/provided-tools.service';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';

export class TeamIntegrations implements TeamIntegrationsPort {
  constructor(private readonly tools: ProvidedTools) {}

  provided(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]> {
    return this.tools.of(teamId, tools);
  }
}
