import type { SearchSummaryDto } from '@replays/application/dto/searches.dto';
import { searchSummaryView } from '@replays/application/services/search-views';
import type { SetNoises } from '@replays/application/services/set-noises.service';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-reading';

export class SearchSummaries {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly noises: SetNoises,
  ) {}

  async of(searches: readonly Search[]): Promise<readonly SearchSummaryDto[]> {
    const [replays, standards] = await Promise.all([
      this.replays.ofSearches(searches.map((each) => each.id)),
      this.noises.standardsAt(searches.map((each) => each.station)),
    ]);
    const viewed = searches.map((search) =>
      searchSummaryView(
        search,
        replays.filter((each) => each.searchId?.equals(search.id) ?? false),
        standards.get(search.station.stationId)?.minGain ?? DEFAULT_MIN_GAIN,
      ),
    );

    return viewed.sort((one, other) =>
      one.startedAt < other.startedAt
        ? 1
        : one.startedAt > other.startedAt
          ? -1
          : 0,
    );
  }
}
