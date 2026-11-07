import type { LinesPort } from '@replays/application/ports/lines.port';
import type {
  AgentProblem,
  RunsPort,
} from '@replays/application/ports/runs.port';
import {
  type SeenRun,
  seenRunOf,
} from '@replays/domain/services/search-reconciliation';
import {
  ReplaysRequester,
  type SearchIteration,
} from '@replays/domain/value-objects/replays-requester.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface SearchRunOrder {
  readonly run: RunId;
  readonly searchId: SearchId;
  readonly iteration: number;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly agent: SearchAgent;
  readonly briefing: string;
}

export type SearchRunQueued =
  | { readonly queued: true }
  | { readonly queued: false; readonly reason: string };

export type LeasedSearchRun = SearchIteration;

export type SearchRunStatus = SeenRun;

export type UnclaimedCancellation =
  | { readonly outcome: 'cancelled'; readonly started: boolean }
  | { readonly outcome: 'claimed' }
  | { readonly outcome: 'ended' };

export interface SearchRunDispatching {
  agentProblem(agent: SearchAgent): AgentProblem | null;

  dispatchSearch(order: SearchRunOrder): Promise<SearchRunQueued>;

  cancelSearchRun(run: RunId): Promise<void>;

  cancelUnclaimedSearchRun(run: RunId): Promise<UnclaimedCancellation>;

  leasedSearchRun(
    run: RunId,
    runnerId: string,
  ): Promise<LeasedSearchRun | null>;

  searchRunStatuses(
    runs: readonly RunId[],
  ): Promise<readonly SearchRunStatus[]>;
}

const STOPPED = 'Search stopped before a runner claimed the run.';

const LEFT_UNCLAIMED =
  'No runner claimed the run in time. Its search cancelled it.';

const requesterOf = (order: SearchRunOrder): ReplaysRequester =>
  ReplaysRequester.searchIteration(order.searchId, order.iteration);

export class SearchRunDispatch implements SearchRunDispatching {
  constructor(
    private readonly runs: RunsPort,
    private readonly lines: LinesPort,
  ) {}

  agentProblem(agent: SearchAgent): AgentProblem | null {
    return this.runs.agentProblem(agent);
  }

  async dispatchSearch(order: SearchRunOrder): Promise<SearchRunQueued> {
    if (await this.alreadyQueued(order)) {
      return { queued: true };
    }

    const station = await this.lines.searchedStation(
      order.lineId,
      order.stationId,
    );

    if (!station?.runsAnAgent) {
      return {
        queued: false,
        reason: 'the line no longer has the station it searches',
      };
    }

    const enqueued = await this.runs.enqueueSearch({
      run: order.run,
      requester: requesterOf(order),
      workspaceId: station.workspaceId,
      teamId: station.teamId,
      agent: order.agent,
      briefing: order.briefing,
      placement: station.placement,
    });

    switch (enqueued.outcome) {
      case 'enqueued':
        return { queued: true };
      case 'refused':
        return { queued: false, reason: enqueued.reason };
      case 'harness-unavailable':
        return {
          queued: false,
          reason: `no runner can start ${order.agent.harness}, the harness it searches with`,
        };
    }
  }

  async cancelSearchRun(run: RunId): Promise<void> {
    const cancelled = await this.runs.cancelIfQueued(run, STOPPED);

    if (cancelled.outcome === 'claimed') {
      await this.runs.cancel(run, STOPPED);
    }
  }

  async cancelUnclaimedSearchRun(run: RunId): Promise<UnclaimedCancellation> {
    const cancelled = await this.runs.cancelIfQueued(run, LEFT_UNCLAIMED);

    switch (cancelled.outcome) {
      case 'cancelled':
        return { outcome: 'cancelled', started: cancelled.started };
      case 'claimed':
        return { outcome: 'claimed' };
      case 'ended':
      case 'unknown':
        return { outcome: 'ended' };
    }
  }

  async leasedSearchRun(
    run: RunId,
    runnerId: string,
  ): Promise<LeasedSearchRun | null> {
    return (await this.runs.leasedBy(run, runnerId))?.searchIteration ?? null;
  }

  async searchRunStatuses(
    runs: readonly RunId[],
  ): Promise<readonly SearchRunStatus[]> {
    if (runs.length === 0) {
      return [];
    }

    return (await this.runs.statuses(runs))
      .filter((each) => each.requester?.searchIteration)
      .map(seenRunOf);
  }

  private async alreadyQueued(order: SearchRunOrder): Promise<boolean> {
    const [known] = await this.runs.statuses([order.run]);

    if (!known) {
      return false;
    }

    if (!known.requester?.equals(requesterOf(order))) {
      throw new InconsistentStateError(
        'run',
        `${order.run.value} is already a run of something other than iteration ${order.iteration} of search ${order.searchId.value}`,
      );
    }

    return true;
  }
}
