import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_RESOURCES = Symbol('INTEGRATION_RESOURCES');

export interface KeptIntegration extends DefinedIntegration {
  readonly teamId: TeamId;
}

export interface IntegrationResourcesPort {
  withId(id: string): Promise<KeptIntegration | null>;

  at(teamId: TeamId, source: string): Promise<KeptIntegration | null>;

  ofTeam(teamId: TeamId): Promise<readonly KeptIntegration[]>;
}
