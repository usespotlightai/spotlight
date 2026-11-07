import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { pendingPickOf } from '@replays/domain/services/pending-pick';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export const resultPendingAt = async (
  stationId: StationId,
  searches: SearchRepository,
  pullRequests: ConfigPullRequestRepository,
): Promise<boolean> => {
  const newest = await searches.newestAtStation(stationId);
  const picked = newest?.pickedCandidate ?? null;
  const pickHasPullRequest =
    newest !== null &&
    picked !== null &&
    (await pullRequests.forCandidate(newest.id, picked)) !== null;

  return pendingPickOf(newest, pickHasPullRequest) !== null;
};
