import type { DependencyFacts } from '@replays/domain/value-objects/dependency-facts';
import type {
  PlannedHook,
  PlannedIntegration,
} from '@replays/domain/value-objects/planned-changes.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const DEPENDENCY_FACTS = Symbol('REPLAYS_DEPENDENCY_FACTS');

export interface CheckedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: string;
  readonly lineKey: string;
  readonly stationKey: string;
}

export interface DependencyFactsPort {
  of(
    station: CheckedStation,
    secrets: readonly SecretName[],
    hooks: readonly PlannedHook[],
    integrations: readonly PlannedIntegration[],
  ): Promise<DependencyFacts>;
}
