import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LISTED_SERVERS = Symbol('LISTED_SERVERS');

export interface ListedServer {
  readonly teamId: TeamId;
  readonly source: SourceKey;
}

export interface ListedServersPort {
  claimListedBefore(before: Date, at: Date): Promise<readonly ListedServer[]>;
}
