import type { SearchSummaryDto } from '@replays/application/dto/searches.dto';
import { searchSummaryView } from '@replays/application/services/search-views';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';

export class SearchSummaries {
  constructor(private readonly replays: ReplayRepository) {}

  async of(searches: readonly Search[]): Promise<readonly SearchSummaryDto[]> {
    const replays = await this.replays.ofSearches(
      searches.map((each) => each.id),
    );
    const viewed = searches.map((search) =>
      searchSummaryView(
        search,
        replays.filter((each) => each.searchId?.equals(search.id) ?? false),
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
