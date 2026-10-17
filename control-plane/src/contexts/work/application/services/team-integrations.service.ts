import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export class TeamIntegrations {
  constructor(private readonly integrations: TeamIntegrationsPort) {}

  async provided(
    line: Line,
    tools: readonly Tool[],
  ): Promise<readonly DeclaredTool[]> {
    const integrationTools = tools
      .filter((each) => each.origin === 'integration')
      .map((each) => each.value);

    return integrationTools.length > 0
      ? (await this.integrations.provided(line.teamId, integrationTools)).map(
          ToolDeclarationMapper.toDeclared,
        )
      : [];
  }
}
