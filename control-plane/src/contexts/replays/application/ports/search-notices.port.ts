import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SEARCH_NOTICES = Symbol('REPLAYS_SEARCH_NOTICES');

export interface SearchNotice {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly addressee: UserId;
  readonly searchId: SearchId;
  readonly lineId: string;
  readonly stationId: string;
  readonly about: string;
  readonly endedSearch: boolean;
  readonly headline: string;
  readonly points: readonly string[];
}

export interface SearchNoticesPort {
  notify(notice: SearchNotice): Promise<void>;
}
