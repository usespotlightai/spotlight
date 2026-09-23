import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const DEFINED_INTEGRATIONS = Symbol('DEFINED_INTEGRATIONS');

export interface DefinedIntegration {
  readonly source: string;
  readonly definition: Readonly<Record<string, unknown>>;
}

export interface TeamDefinedIntegrations {
  readonly teamId: TeamId;
  readonly integrations: readonly DefinedIntegration[];
}

export interface DefinedIntegrationsPort {
  ofTeam(teamId: TeamId): Promise<readonly DefinedIntegration[]>;

  everywhere(): Promise<readonly TeamDefinedIntegrations[]>;
}
