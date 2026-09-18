import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

export class TeamIntegrations {
  constructor(private readonly integrations: TeamIntegrationsPort) {}

  async offered(line: Line): Promise<readonly DeclaredTool[]> {
    return (await this.integrations.offered(line.teamId)).map(
      ToolDeclarationMapper.toDeclared,
    );
  }
}
