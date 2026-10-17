import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const CONNECTED_INTEGRATIONS = Symbol('CONNECTED_INTEGRATIONS');

export interface ConnectedIntegration {
  readonly integration: string;
  readonly linkedAccount: string | null;
}

export interface ConnectedIntegrationsPort {
  ofTeam(teamId: TeamId): Promise<readonly ConnectedIntegration[]>;
}
