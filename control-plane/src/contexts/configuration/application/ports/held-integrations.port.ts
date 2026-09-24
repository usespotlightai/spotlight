import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HELD_INTEGRATIONS = Symbol('HELD_INTEGRATIONS');

export interface WornSecret {
  readonly path: FieldPath;
  readonly name: string;
}

export interface HeldIntegration {
  readonly id: string;
  readonly address: string;
  readonly teamId: TeamId;
  readonly source: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly secretsWorn: readonly WornSecret[];
}

export interface HeldIntegrationsPort {
  withId(id: string): Promise<HeldIntegration | null>;

  ofTeam(teamId: TeamId): Promise<readonly HeldIntegration[]>;
}
