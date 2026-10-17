import type {
  InsightsReaderPort,
  ListedRun,
  RunsListed,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import type { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskChangeShape } from '@outcomes/domain/aggregates/task-change-shape.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import type { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import { ScoresInMemory } from '@outcomes/domain/judging.fake-spec';
import type { RunPage } from '@outcomes/domain/outcomes.fake-spec';
import {
  PullRequestRecordsInMemory,
  TaskChangeShapesInMemory,
  type TeamPullRequestWindow,
} from '@outcomes/domain/pull-requests.fake-spec';
import type {
  RunListing,
  RunRecordRepository,
  TeamWindow,
} from '@outcomes/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { changeCountsOf } from '@outcomes/domain/services/before-after';
import type { CarriedConfigs } from '@outcomes/domain/services/config-stretches';
import { costCountsOf } from '@outcomes/domain/services/cost-breakdown';
import { flowCountsOf } from '@outcomes/domain/services/flow';
import { judgedRunsOf } from '@outcomes/domain/services/judge-shares';
import { spendingOf } from '@outcomes/domain/services/measures';
import { memoryCountsOf } from '@outcomes/domain/services/memory-comparison';
import { overviewCountsOf } from '@outcomes/domain/services/overview-counts';
import { peopleCountsOf } from '@outcomes/domain/services/people-counts';
import { filteredPullRequests } from '@outcomes/domain/services/pull-request-filter';
import { pullRequestCountsOf } from '@outcomes/domain/services/pull-request-insights';
import { pullRequestTypeOf } from '@outcomes/domain/services/pull-request-types';
import { inEndOrder } from '@outcomes/domain/services/run-order';
import {
  setupCountsOf,
  setupRunsWithin,
} from '@outcomes/domain/services/setup-comparison';
import {
  pipelineCountsOf,
  shippedTaskIdsOf,
  shippingCountsOf,
} from '@outcomes/domain/services/shipping';
import { teamCountsOf } from '@outcomes/domain/services/station-reports';
import {
  openingsOf,
  stationsOf,
  type TeamHistory,
  tasksOf,
} from '@outcomes/domain/services/team-history';
import {
  type TeamPullRequest,
  teamPullRequestFrom,
} from '@outcomes/domain/services/team-pull-requests';
import { toolCountsOf } from '@outcomes/domain/services/tool-insights';
import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const ALL = Number.MAX_SAFE_INTEGER;

type TeamBetween<T> = (
  window: TeamWindow,
  max: number,
) => Promise<readonly T[]>;

export interface HistoryRepositories {
  readonly records: Pick<
    RunRecordRepository,
    'lastConfigRunsBefore' | 'ofTasks'
  > & {
    readonly endedForTeam: TeamBetween<RunRecord>;
    readonly listedForTeam: (listing: RunListing) => Promise<RunPage>;
  };
  readonly deliveries: Pick<TaskDeliveryRepository, 'forTasks'> & {
    readonly ofTeamBetween: TeamBetween<TaskDelivery>;
  };
  readonly touches: {
    readonly forTasks: (
      taskIds: readonly TaskId[],
    ) => Promise<readonly TaskTouches[]>;
    readonly ofTeamBetween: TeamBetween<TaskTouches>;
  };
  readonly failures: { readonly ofTeamBetween: TeamBetween<TaskFailures> };
  readonly chats: { readonly ofTeamBetween: TeamBetween<ChatRecord> };
}

export const storedHistoryOf = async (
  repositories: HistoryRepositories,
  { workspaceId, teamId, period }: TeamInPeriod,
): Promise<TeamHistory> => {
  const window = { workspaceId, teamId, ...period.lookback };

  return {
    records: await repositories.records.endedForTeam(window, ALL),
    deliveries: await repositories.deliveries.ofTeamBetween(window, ALL),
    touches: await repositories.touches.ofTeamBetween(window, ALL),
    failures: await repositories.failures.ofTeamBetween(window, ALL),
    chats: await repositories.chats.ofTeamBetween(window, ALL),
  };
};

export const storedCarriedOf = async (
  repositories: HistoryRepositories,
  team: TeamInPeriod,
  history: TeamHistory,
): Promise<CarriedConfigs> => {
  const from = team.period.lookback.from;

  return {
    from,
    lastRuns: await repositories.records.lastConfigRunsBefore(
      team.teamId,
      stationsOf(history.records).map(({ stationId }) => ({ stationId, from })),
    ),
  };
};

const openingsFor = async (
  repositories: HistoryRepositories,
  history: TeamHistory,
) =>
  openingsOf(
    await repositories.touches.forTasks([
      ...history.failures.map((each) => each.taskId),
      ...history.deliveries.map((each) => each.taskId),
    ]),
  );

export interface PullRequestCoverage {
  readonly repositories: readonly string[];
  readonly from: Date;
  readonly max: number;
}

export interface PullRequestRepositories {
  readonly records: {
    readonly seenForTeamBetween: (
      window: TeamPullRequestWindow,
      max: number,
    ) => Promise<readonly PullRequestRecord[]>;
  };
  readonly shapes: {
    readonly forTasks: (
      taskIds: readonly TaskId[],
    ) => Promise<readonly TaskChangeShape[]>;
  };
}

const storedPullRequestOf = (
  record: PullRequestRecord,
  shape: TaskChangeShape | null,
  spends: readonly (Spend | null)[],
): TeamPullRequest | null => {
  const seen = record.seen;

  if (!seen) {
    return null;
  }

  const shaped = record.owner ? shape?.shape : undefined;

  return teamPullRequestFrom({
    pullRequest: record.pullRequest.value,
    seen,
    ownerTaskId: record.owner?.taskId.value ?? null,
    reviewTaskIds: record.reviewTasks.map((each) => each.value),
    type: pullRequestTypeOf({
      changeTitles: shaped?.changeTitles ?? [],
      changeIntents: shaped?.changeIntents ?? [],
      title: seen.title,
      branch: seen.branch,
    }),
    spending: spendingOf(spends),
  });
};

export const pullRequestsStoredIn = async (
  runs: Pick<RunRecordRepository, 'ofTasks'>,
  pullRequests: PullRequestRepositories,
  { workspaceId, teamId, period }: TeamInPeriod,
  coverage: PullRequestCoverage,
): Promise<readonly TeamPullRequest[]> => {
  const records = await pullRequests.records.seenForTeamBetween(
    {
      workspaceId,
      teamId,
      repositories: coverage.repositories,
      from: coverage.from,
      to: period.current.to,
    },
    coverage.max,
  );
  const owners = records.flatMap((each) =>
    each.owner ? [each.owner.taskId] : [],
  );
  const ran = [...(await runs.ofTasks(owners))]
    .filter((each) => each.hasEnded)
    .sort(inEndOrder);
  const shapes = await pullRequests.shapes.forTasks(owners);

  return records.flatMap((record) => {
    const owner = record.owner?.taskId;
    const view = storedPullRequestOf(
      record,
      (owner && shapes.find((each) => each.taskId.equals(owner))) || null,
      owner
        ? ran
            .filter((each) => each.taskId?.equals(owner))
            .map((each) => each.cost?.spend ?? null)
        : [],
    );

    return view ? [view] : [];
  });
};

const coverageFrom = (
  from: Date,
  repositories: readonly string[],
): PullRequestCoverage => ({
  repositories,
  from,
  max: Number.MAX_SAFE_INTEGER,
});

const listedRunOf = (
  record: RunRecord,
  openedBy: string | null,
  delivery: DeliveryState | null,
): ListedRun | null => {
  const { end, ending } = record;

  return end && ending
    ? {
        runId: record.runId.value,
        taskId: end.place.taskId.value,
        lineId: end.place.lineId,
        stationId: end.place.stationId,
        fingerprint: end.fingerprint,
        harness: end.setup.harness,
        model: end.setup.model,
        effort: end.setup.effort,
        profileKey: end.setup.profileKey,
        repositories: end.setup.repositories,
        openedBy,
        queuedAt: end.queuedAt,
        startedAt: end.startedAt,
        endedAt: end.endedAt,
        queuedMs: end.queuedMs,
        runningMs: end.runningMs,
        ms: record.cost?.ms ?? null,
        cost: record.cost?.spend ?? null,
        tokens: record.cost?.tokens ?? null,
        ending,
        failure: end.failure,
        checks: record.checks,
        next: record.next ? { act: record.next.act, at: record.next.at } : null,
        passed: record.passed
          ? { to: record.passed.to, at: record.passed.at }
          : null,
        delivery,
      }
    : null;
};

export const runsListedIn = async (
  repositories: Pick<HistoryRepositories, 'records' | 'touches' | 'deliveries'>,
  listing: RunListing,
): Promise<RunsListed> => {
  const listed = await repositories.records.listedForTeam(listing);
  const worked = tasksOf(listed.records).map((each) => TaskId.of(each));
  const openers = new Map(
    (await repositories.touches.forTasks(worked)).map((each) => [
      each.taskId.value,
      each.opening?.by?.value ?? null,
    ]),
  );
  const deliveries = new Map(
    (await repositories.deliveries.forTasks(worked)).map((each) => [
      each.taskId.value,
      each.state,
    ]),
  );

  return {
    total: listed.total,
    runs: listed.records.flatMap((record) => {
      const taskId = record.taskId?.value ?? '';
      const run = listedRunOf(
        record,
        openers.get(taskId) ?? null,
        deliveries.get(taskId) ?? null,
      );

      return run ? [run] : [];
    }),
  };
};

export const insightsReaderInMemory = (
  historyRepositories: HistoryRepositories,
  scores: ScoreRepository = new ScoresInMemory(),
  pullRequests: PullRequestRepositories = {
    records: new PullRequestRecordsInMemory(),
    shapes: new TaskChangeShapesInMemory(),
  },
): InsightsReaderPort => ({
  stationCounts: async (team) => {
    const history = await storedHistoryOf(historyRepositories, team);

    return teamCountsOf(
      {
        ...history,
        touches: [
          ...(await openingsFor(historyRepositories, history)).values(),
        ],
      },
      team.period,
    );
  },
  costCounts: async (team) => {
    const history = await storedHistoryOf(historyRepositories, team);

    return {
      current: costCountsOf(history, team.period.current),
      spendBefore: costCountsOf(history, team.period.previous).spend,
    };
  },
  flowCounts: async (team) => {
    const history = await storedHistoryOf(historyRepositories, team);

    return flowCountsOf(
      history,
      team.period,
      await openingsFor(historyRepositories, history),
    );
  },
  peopleCounts: async (team) =>
    peopleCountsOf(
      await storedHistoryOf(historyRepositories, team),
      team.period,
    ),
  overviewCounts: async (team) => {
    const history = await storedHistoryOf(historyRepositories, team);

    return overviewCountsOf(
      history,
      team.period,
      await storedCarriedOf(historyRepositories, team, history),
      await openingsFor(historyRepositories, history),
    );
  },
  toolCounts: async (team) =>
    toolCountsOf(
      await storedHistoryOf(historyRepositories, team),
      team.period.current,
    ),
  memoryCounts: async (team) =>
    memoryCountsOf(
      await storedHistoryOf(historyRepositories, team),
      team.period.current,
    ),
  setupCounts: async (team, filter) => {
    const history = await storedHistoryOf(historyRepositories, team);
    const records = setupRunsWithin(
      history.records,
      team.period.current,
      filter.stationId,
      filter.size,
    );

    return setupCountsOf(
      records,
      history.deliveries,
      filter.stationId === null
        ? []
        : judgedRunsOf(
            await scores.ofRuns(records.map((each) => each.runId)),
            filter.stationId,
          ),
    );
  },
  changeCounts: async (team) => {
    const history = await storedHistoryOf(historyRepositories, team);

    return changeCountsOf(
      history,
      team.period,
      await storedCarriedOf(historyRepositories, team, history),
      await scores.ofRuns(history.records.map((each) => each.runId)),
    );
  },
  pullRequestCounts: async (team, repositories) =>
    pullRequestCountsOf(
      await pullRequestsStoredIn(
        historyRepositories.records,
        pullRequests,
        team,
        coverageFrom(team.period.current.from, repositories),
      ),
      team.period.current,
    ),
  pullRequestPage: async (team, { repositories, filter, page, size }) => {
    const listed = filteredPullRequests(
      await pullRequestsStoredIn(
        historyRepositories.records,
        pullRequests,
        team,
        coverageFrom(team.period.current.from, repositories),
      ),
      filter,
      team.period.current,
    );

    return {
      total: listed.length,
      pullRequests: listed.slice((page - 1) * size, page * size),
    };
  },
  runPage: (listing) => runsListedIn(historyRepositories, listing),
  shippingCounts: async (team, repositories) => {
    const covered = await pullRequestsStoredIn(
      historyRepositories.records,
      pullRequests,
      team,
      coverageFrom(team.period.previous.from, repositories),
    );

    return shippingCountsOf(
      covered,
      pipelineCountsOf(
        await storedHistoryOf(historyRepositories, team),
        shippedTaskIdsOf(covered, team.period),
        team.period,
      ),
      team.period,
    );
  },
});
