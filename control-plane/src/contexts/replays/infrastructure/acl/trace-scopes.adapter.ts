import type { SearchVisibilities } from '@replays/application/queries/search-visibilities';
import { isSearchRequester } from '@replays/application/services/search-run-dispatch.service';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';
import type {
  TraceScope,
  TraceScopeSource,
} from '@work/application/ports/trace-scopes.port';

export class ReplaysTraceScopes implements TraceScopeSource {
  readonly owner = 'replays';

  constructor(private readonly visibilities: SearchVisibilities) {}

  async scopeOf(requester: RunRequesterContract): Promise<TraceScope | null> {
    if (!isSearchRequester(requester)) {
      return null;
    }

    const scope = await this.visibilities.scopeOf(SearchId.of(requester.id));

    return (
      scope && {
        stationId: scope.stationId,
        hiddenTaskIds: [...scope.heldOutTasks],
        shownRunIds: [...scope.shownOriginals],
      }
    );
  }
}
