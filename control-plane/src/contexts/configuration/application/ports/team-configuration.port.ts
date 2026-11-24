import type {
  HookAtStation,
  HookStation,
  PlannedHookMatch,
} from '@configuration/application/ports/hook-configs.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_CONFIGURATION = Symbol('TEAM_CONFIGURATION');

export type { HookAtStation, HookStation, PlannedHookMatch };

export interface ConfiguredSkill {
  readonly key: string;
  readonly secrets: readonly string[];
}

export interface PlannedIntegration {
  readonly key: string;
  readonly definition: Readonly<Record<string, unknown>> | null;
}

export interface TeamConfigurationPort {
  skills(teamId: TeamId): Promise<readonly ConfiguredSkill[]>;

  hooksAt(
    teamId: TeamId,
    station: HookStation,
    planned: readonly PlannedHookMatch[],
  ): Promise<readonly HookAtStation[]>;

  enablingToolsOnMarks(
    planned: readonly PlannedIntegration[],
  ): Promise<readonly string[]>;
}
