import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_RESOURCES = Symbol('INTEGRATION_RESOURCES');

export interface IntegrationRecord extends DefinedIntegration {
  readonly teamId: TeamId;
}

export interface IntegrationResourcesPort {
  withId(id: string): Promise<IntegrationRecord | null>;

  at(teamId: TeamId, source: string): Promise<IntegrationRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly IntegrationRecord[]>;
}
