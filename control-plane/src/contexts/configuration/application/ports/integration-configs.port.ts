import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_CONFIGS = Symbol('INTEGRATION_CONFIGS');

export interface WornSecret {
  readonly path: FieldPath;
  readonly name: string;
}

export interface IntegrationConfig {
  readonly id: string;
  readonly address: string;
  readonly teamId: TeamId;
  readonly source: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly secretsWorn: readonly WornSecret[];
}

export interface IntegrationConfigsPort {
  withId(id: string): Promise<IntegrationConfig | null>;

  ofTeam(teamId: TeamId): Promise<readonly IntegrationConfig[]>;
}
