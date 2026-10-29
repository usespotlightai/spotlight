import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SEARCH_NOTICES = Symbol('REPLAYS_SEARCH_NOTICES');

export interface StationNotice {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
  readonly about: string;
  readonly headline: string;
  readonly points: readonly string[];
}

export interface SearchNotice extends StationNotice {
  readonly searchId: SearchId;
  readonly addressee: UserId | null;
  readonly pullRequest: string | null;
}

export interface SearchNoticesPort {
  notify(notice: SearchNotice): Promise<void>;

  advise(notice: StationNotice): Promise<void>;
}
