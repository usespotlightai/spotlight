import type {
  LinesPort,
  PlannedLines,
} from '@configuration/application/ports/lines.port';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { stationPath } from '@work/application/contracts/line-layout.contract';
import type { ConfiguredLinesPort } from '@work/application/ports/configured-lines.port';

export class Lines implements LinesPort {
  constructor(private readonly lines: ConfiguredLinesPort) {}

  async plan(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<PlannedLines> {
    const planned = await this.lines.plan(teamId, files);

    return {
      stations: planned.stations.map((each) => ({
        path: stationPath(each.line, each.station),
        tools: each.tools.map((tool) => ToolName.of(tool)),
        skills: each.skills.map((skill) => SkillKey.of(skill)),
      })),
      problems: planned.problems,
    };
  }

  offersBuiltIn(tool: ToolName): boolean {
    return this.lines.offersBuiltIn(tool.value);
  }
}
