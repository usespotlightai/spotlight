import type { ProvidedTools } from '@integrations/application/services/provided-tools.service';
import { ToolDeclarationMapper } from '@integrations/infrastructure/acl/tool-declaration.mapper';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';

export class TeamIntegrations implements TeamIntegrationsPort {
  constructor(private readonly tools: ProvidedTools) {}

  async provided(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]> {
    return (await this.tools.of(teamId, tools)).map((each) =>
      ToolDeclarationMapper.toDeclaration(each),
    );
  }
}
