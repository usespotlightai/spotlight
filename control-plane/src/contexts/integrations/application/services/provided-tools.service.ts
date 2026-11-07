import type { DeclaredTool } from '@integrations/application/dto/declared-tool.dto';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { ToolDeclarationsPort } from '@integrations/application/ports/tool-declarations.port';
import type { ToolOutputShapesPort } from '@integrations/application/ports/tool-output-shapes.port';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ProvidedTools {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly declarations: ToolDeclarationsPort,
    private readonly shapes: ToolOutputShapesPort,
  ) {}

  async of(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly DeclaredTool[]> {
    const declared = await this.declarations.declared(
      await this.defined.ofTeam(teamId),
      tools,
    );
    const shapes = await this.shapes.ofTools(
      teamId,
      ToolName.parsedAll(declared.map((each) => each.tool)),
    );

    return declared.map((each) => ({
      ...each,
      inferredOutput: shapes.get(each.tool) ?? null,
    }));
  }
}
