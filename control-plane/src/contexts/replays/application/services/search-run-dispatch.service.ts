import type { LinesPort } from '@replays/application/ports/lines.port';
import type {
  AgentProblem,
  RunState,
  RunStatus,
  RunsPort,
} from '@replays/application/ports/runs.port';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import {
  type RunPolicyContract,
  type RunRequesterContract,
  workspaceKeyOf,
} from '@runs/application/contracts/run-order.contract';
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

export interface LeasedSearchRun {
  readonly searchId: SearchId;
  readonly iteration: number;
}

export interface SearchRunStatus {
  readonly run: RunId;
  readonly phase: 'queued' | 'running' | 'ended';
  readonly failed: boolean;
  readonly started: boolean;
  readonly queuedAt: Date;
  readonly endedAt: Date | null;
}

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

export const SEARCH_RUN_POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
};

const SEARCH_PRIORITY = -1;

const STOPPED = 'Search stopped before a runner claimed the run.';

const LEFT_UNCLAIMED =
  'No runner claimed the run in time. Its search cancelled it.';

const PHASE: Readonly<Record<RunState, SearchRunStatus['phase']>> = {
  queued: 'queued',
  claimed: 'running',
  suspended: 'running',
  completed: 'ended',
  failed: 'ended',
  cancelled: 'ended',
};

const statusOf = (status: RunStatus): SearchRunStatus => ({
  run: status.run,
  phase: PHASE[status.state],
  failed: status.state !== 'completed' || status.askedAPerson,
  started: status.started,
  queuedAt: status.queuedAt,
  endedAt: status.endedAt,
});

const requesterOf = (
  order: SearchRunOrder,
  team: string | null,
): RunRequesterContract => ({
  owner: 'replays',
  kind: 'search',
  id: order.searchId.value,
  token: String(order.iteration),
  team,
});

const sameRequester = (
  one: RunRequesterContract,
  other: RunRequesterContract,
): boolean =>
  one.owner === other.owner &&
  one.kind === other.kind &&
  one.id === other.id &&
  one.token === other.token;

export const isSearchRequester = (requester: RunRequesterContract): boolean =>
  requester.owner === 'replays' && requester.kind === 'search';

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

    const requester = requesterOf(order, station.teamId.value);
    const command = this.runs.commandFor(order.agent, requester, order.run);

    if (!command) {
      return {
        queued: false,
        reason: `no runner can start ${order.agent.harness}, the harness it searches with`,
      };
    }

    const enqueued = await this.runs.enqueue({
      runId: order.run.value,
      workspaceId: station.workspaceId.value,
      harness: order.agent.harness,
      priority: SEARCH_PRIORITY,
      placement: {
        labelGroups: station.placement.labelGroups,
        image: station.placement.image,
      },
      spec: {
        command,
        briefing: order.briefing,
        handover: { options: [], noteLimit: 0 },
        resume: {},
      },
      requester,
      policy: SEARCH_RUN_POLICY,
      workspace: {
        key: workspaceKeyOf('replays', `search-${order.run.value}`),
        rejoinable: false,
        restores: 'when-continuing',
      },
      restore: null,
      extensions: { search: {} },
      apiGrant: null,
      tags: {},
      refusal: null,
    });

    return enqueued.enqueued
      ? { queued: true }
      : { queued: false, reason: enqueued.reason };
  }

  async cancelSearchRun(run: RunId): Promise<void> {
    const cancelled = await this.runs.cancelIfQueued(run, STOPPED);

    if (cancelled.outcome === 'claimed') {
      await this.runs.cancel(run);
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
    const requester = await this.runs.leasedBy(run, runnerId);

    return requester && isSearchRequester(requester) && requester.token
      ? {
          searchId: SearchId.of(requester.id),
          iteration: Number(requester.token),
        }
      : null;
  }

  async searchRunStatuses(
    runs: readonly RunId[],
  ): Promise<readonly SearchRunStatus[]> {
    if (runs.length === 0) {
      return [];
    }

    return (await this.runs.statuses(runs))
      .filter((each) => isSearchRequester(each.requester))
      .map(statusOf);
  }

  private async alreadyQueued(order: SearchRunOrder): Promise<boolean> {
    const [known] = await this.runs.statuses([order.run]);

    if (!known) {
      return false;
    }

    if (!sameRequester(known.requester, requesterOf(order, null))) {
      throw new InconsistentStateError(
        'run',
        `${order.run.value} is already a run of something other than iteration ${order.iteration} of search ${order.searchId.value}`,
      );
    }

    return true;
  }
}
