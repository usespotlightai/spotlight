import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_CONNECTION_ROSTER = Symbol(
  'INTEGRATION_CONNECTION_ROSTER',
);

export interface PersonConnection {
  readonly integration: string;
  readonly personId: string;
  readonly linkedAccount: string | null;
  readonly connectedAt: Date;
}

export interface IntegrationConnectionRosterPort {
  ofTeam(teamId: TeamId): Promise<readonly PersonConnection[]>;
}
