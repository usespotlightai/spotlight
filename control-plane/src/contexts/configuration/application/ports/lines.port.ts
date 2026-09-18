import type { GivingStation } from '@configuration/domain/services/configuration-gaps';
import type { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LINES = Symbol('CONFIGURATION_LINES');

export interface PlannedLines {
  readonly stations: readonly GivingStation[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface LinesPort {
  plan(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<PlannedLines>;

  offersBuiltIn(tool: ToolName): boolean;
}
