import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';

export class TeamIntegrations implements TeamIntegrationsPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
    private readonly schemas: InferredOutputSchemaRepository,
  ) {}

  async provided(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]> {
    const declared = await this.reader.declared(
      await this.defined.ofTeam(teamId),
      tools,
    );
    const inferred = await this.schemas.ofTools(
      teamId,
      declared.map((each) => each.tool),
    );
    const shapes = new Map(
      inferred.map((each) => [each.tool.value, each.shape.schema]),
    );

    return declared.map((each) => ({
      ...each,
      inferredOutput: shapes.get(each.tool) ?? null,
    }));
  }
}
