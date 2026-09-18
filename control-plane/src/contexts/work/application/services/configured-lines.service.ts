import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  ConfiguredLines,
  ConfiguredLinesPort,
} from '@work/application/ports/configured-lines.port';
import type { ApplyLines } from '@work/application/services/apply-lines.service';
import { builtInTool } from '@work/domain/services/built-in-tools';
import { Tool } from '@work/domain/value-objects/tool.vo';

export class ConfiguredLinesService implements ConfiguredLinesPort {
  constructor(private readonly applying: ApplyLines) {}

  async plan(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<ConfiguredLines> {
    const applied = await this.applying.plan(teamId, files);

    return {
      stations: applied.plans.flatMap((plan) =>
        plan.stations.map((station) => ({
          line: plan.key.value,
          station: station.key.value,
          tools: station.tools.map((each) => each.value),
          skills: station.skills.map((each) => each.value),
        })),
      ),
      problems: applied.problems,
    };
  }

  async apply(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<void> {
    await this.applying.apply(teamId, files);
  }

  offersBuiltIn(tool: string): boolean {
    try {
      return builtInTool(Tool.of(tool)) !== null;
    } catch {
      return false;
    }
  }
}
