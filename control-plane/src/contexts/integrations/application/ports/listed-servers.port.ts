import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LISTED_SERVERS = Symbol('LISTED_SERVERS');

export interface ListedServer {
  readonly teamId: TeamId;
  readonly integration: IntegrationKey;
}

export interface ListedServersPort {
  listedBefore(before: Date): Promise<readonly ListedServer[]>;
}
