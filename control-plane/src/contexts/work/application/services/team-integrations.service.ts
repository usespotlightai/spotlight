import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class TeamIntegrations {
  constructor(private readonly integrations: TeamIntegrationsPort) {}

  async provided(
    line: LineMap,
    tools: readonly Tool[],
  ): Promise<readonly DeclaredTool[]> {
    const integrationTools = tools
      .filter((each) => each.origin === 'integration')
      .map((each) => each.value);

    return integrationTools.length > 0
      ? (await this.integrations.provided(line.teamId, integrationTools)).map(
          (each) => ToolDeclarationMapper.toDeclared(each),
        )
      : [];
  }

  async toolsOnMarks(
    line: LineMap,
    marks: readonly Mark[],
  ): Promise<readonly Tool[]> {
    return marks.length > 0
      ? (
          await this.integrations.toolsOnMarks(
            line.teamId,
            marks.map((each) => each.kind),
          )
        ).map((each) => Tool.of(each))
      : [];
  }
}
