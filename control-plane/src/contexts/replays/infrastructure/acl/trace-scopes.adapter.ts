import type { SearchVisibilities } from '@replays/application/queries/search-visibilities';
import {
  REPLAYS_OWNER,
  ReplaysRequester,
} from '@replays/domain/value-objects/replays-requester.vo';
import type {
  TracedRequester,
  TraceScope,
  TraceScopeSource,
} from '@work/application/ports/trace-scopes.port';

export class ReplaysTraceScopes implements TraceScopeSource {
  readonly owner = REPLAYS_OWNER;

  constructor(private readonly visibilities: SearchVisibilities) {}

  async scopeOf(requester: TracedRequester): Promise<TraceScope | null> {
    const search = ReplaysRequester.decode(requester)?.searchIteration;

    if (!search) {
      return null;
    }

    const scope = await this.visibilities.scopeOf(search.searchId);

    return (
      scope && {
        stationId: scope.stationId,
        hiddenTaskIds: [...scope.heldOutTasks],
        shownRunIds: [...scope.shownOriginals],
      }
    );
  }
}
