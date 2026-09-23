import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_RESOURCES = Symbol('INTEGRATION_RESOURCES');

export interface KeptIntegration {
  readonly id: string;
  readonly teamId: TeamId;
  readonly source: string;
  readonly version: number;
  readonly definition: Readonly<Record<string, unknown>>;
}

export interface IntegrationResourcesPort {
  withId(id: string): Promise<KeptIntegration | null>;

  at(teamId: TeamId, source: string): Promise<KeptIntegration | null>;
}
