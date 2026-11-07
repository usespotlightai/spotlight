import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const INTEGRATION_CONNECTION_ROSTER = Symbol(
  'INTEGRATION_CONNECTION_ROSTER',
);

export interface PersonConnection {
  readonly integration: string;
  readonly personId: UserId;
  readonly linkedAccount: string | null;
  readonly connectedAt: Date;
}

export interface IntegrationConnectionRosterPort {
  ofTeam(teamId: TeamId): Promise<readonly PersonConnection[]>;
}
