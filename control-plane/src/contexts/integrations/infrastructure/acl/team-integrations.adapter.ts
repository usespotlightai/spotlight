import type { ProvidedTools } from '@integrations/application/services/provided-tools.service';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
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

  async toolsOnMarks(
    teamId: TeamId,
    kinds: readonly string[],
  ): Promise<readonly string[]> {
    return (
      await this.tools.enabledOnMarks(
        teamId,
        kinds.map((each) => MarkKind.of(each)),
      )
    ).map((each) => each.value);
  }
}
