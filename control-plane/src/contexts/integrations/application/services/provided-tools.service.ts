import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { ToolDeclarationsPort } from '@integrations/application/ports/tool-declarations.port';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export class ProvidedTools {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly declarations: ToolDeclarationsPort,
    private readonly schemas: InferredOutputSchemaRepository,
  ) {}

  async of(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]> {
    const declared = await this.declarations.declared(
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
