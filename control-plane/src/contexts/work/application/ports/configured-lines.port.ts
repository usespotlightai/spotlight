import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const CONFIGURED_LINES = Symbol('CONFIGURED_LINES');

export interface StationOffering {
  readonly line: string;
  readonly station: string;
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface ConfiguredLines {
  readonly stations: readonly StationOffering[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface ConfiguredLinesPort {
  plan(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<ConfiguredLines>;

  apply(teamId: TeamId, files: readonly ConfigurationFile[]): Promise<void>;

  offersBuiltIn(tool: string): boolean;
}
