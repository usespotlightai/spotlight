import type {
  InsightsReaderPort,
  ListedRun,
  RunsListed,
  TeamInPeriod,
} from '@insights/application/ports/insights-reader.port';
import type { ChatRecord } from '@insights/domain/aggregates/chat-record.aggregate';
import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import type { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import type { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import { ScoresInMemory } from '@insights/domain/judging.fake-spec';
import {
  PullRequestRecordsInMemory,
  TaskChangeShapesInMemory,
  type TeamPullRequestWindow,
} from '@insights/domain/pull-requests.fake-spec';
import type {
  RunListing,
  RunRecordRepository,
  TeamWindow,
} from '@insights/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import type { RunPage } from '@insights/domain/runs.fake-spec';
import {
  agentConfigCountsOf,
  agentConfigRunsWithin,
} from '@insights/domain/services/agent-config-comparison';
import { changeCountsOf } from '@insights/domain/services/before-after';
import type { CarriedConfigs } from '@insights/domain/services/config-intervals';
import { costCountsOf } from '@insights/domain/services/cost-breakdown';
import { flowCountsOf } from '@insights/domain/services/flow';
import { judgedRunsOf } from '@insights/domain/services/judge-rates';
import { spendingOf } from '@insights/domain/services/measures';
import { memoryCountsOf } from '@insights/domain/services/memory-comparison';
import { overviewCountsOf } from '@insights/domain/services/overview-counts';
import { peopleCountsOf } from '@insights/domain/services/people-counts';
import { filteredPullRequests } from '@insights/domain/services/pull-request-filter';
import { pullRequestCountsOf } from '@insights/domain/services/pull-request-insights';
import { pullRequestTypeOf } from '@insights/domain/services/pull-request-types';
import { EVERY_RUN } from '@insights/domain/services/run-filter';
import { inEndOrder } from '@insights/domain/services/run-order';
import {
  pipelineCountsOf,
  shippedTaskIdsOf,
  shippingCountsOf,
} from '@insights/domain/services/shipping';
import { teamCountsOf } from '@insights/domain/services/station-reports';
import {
  openingsOf,
  stationsOf,
  type TeamHistory,
  tasksOf,
} from '@insights/domain/services/team-history';
import {
  type TeamPullRequest,
  teamPullRequestFrom,
} from '@insights/domain/services/team-pull-requests';
import { toolCountsOf } from '@insights/domain/services/tool-insights';
import { runsPerTask } from '@insights/domain/services/traces';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';
import type { TaskPullRequestState } from '@insights/domain/value-objects/task-pull-request-state';
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
  readonly taskPullRequests: Pick<TaskPullRequestRepository, 'forTasks'> & {
    readonly ofTeamBetween: TeamBetween<TaskPullRequest>;
  };
  readonly taskHumanActions: {
    readonly forTasks: (
      taskIds: readonly TaskId[],
    ) => Promise<readonly TaskHumanActions[]>;
    readonly ofTeamBetween: TeamBetween<TaskHumanActions>;
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
    taskPullRequests: await repositories.taskPullRequests.ofTeamBetween(
      window,
      ALL,
    ),
    taskHumanActions: await repositories.taskHumanActions.ofTeamBetween(
      window,
      ALL,
    ),
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
    await repositories.taskHumanActions.forTasks([
      ...history.failures.map((each) => each.taskId),
      ...history.taskPullRequests.map((each) => each.taskId),
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
  spends: readonly (Money | null)[],
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
            .map((each) => each.usage?.spend ?? null)
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
  pullRequestState: TaskPullRequestState | null,
): ListedRun | null => {
  const { end, ending } = record;

  return end && ending
    ? {
        runId: record.runId.value,
        taskId: end.location.taskId.value,
        lineId: end.location.lineId,
        stationId: end.location.stationId,
        fingerprint: end.fingerprint,
        harness: end.agentConfig.harness,
        model: end.agentConfig.model,
        effort: end.agentConfig.effort,
        profileKey: end.agentConfig.profileKey,
        repositories: end.agentConfig.repositories,
        openedBy,
        queuedAt: end.queuedAt,
        startedAt: end.startedAt,
        endedAt: end.endedAt,
        queuedMs: end.queuedMs,
        runningMs: end.runningMs,
        ms: record.usage?.ms ?? null,
        cost: record.usage?.spend ?? null,
        tokens: record.usage?.tokens ?? null,
        errors: record.usage?.errors ?? null,
        ending,
        failure: end.failure,
        checks: record.checks,
        firstHumanAction: record.firstHumanAction
          ? {
              kind: record.firstHumanAction.kind,
              at: record.firstHumanAction.at,
            }
          : null,
        passed: record.passed
          ? { to: record.passed.to, at: record.passed.at }
          : null,
        pullRequestState,
      }
    : null;
};

export const runsListedIn = async (
  repositories: Pick<
    HistoryRepositories,
    'records' | 'taskHumanActions' | 'taskPullRequests'
  >,
  listing: RunListing,
): Promise<RunsListed> => {
  const listed = await repositories.records.listedForTeam(listing);
  const worked = tasksOf(listed.records).map((each) => TaskId.of(each));
  const openers = new Map(
    (await repositories.taskHumanActions.forTasks(worked)).map((each) => [
      each.taskId.value,
      each.opening?.by?.value ?? null,
    ]),
  );
  const taskPullRequests = new Map(
    (await repositories.taskPullRequests.forTasks(worked)).map((each) => [
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
        taskPullRequests.get(taskId) ?? null,
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
        taskHumanActions: [
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
  agentConfigCounts: async (team, filter) => {
    const history = await storedHistoryOf(historyRepositories, team);
    const records = agentConfigRunsWithin(
      history.records,
      team.period.current,
      filter.stationId,
      filter.size,
    );

    return agentConfigCountsOf(
      records,
      history.taskPullRequests,
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
  runsPerTask: async (window, taskIds) =>
    runsPerTask(
      (
        await historyRepositories.records.listedForTeam({
          window,
          filter: { ...EVERY_RUN, taskIds },
          offset: 0,
          limit: Number.MAX_SAFE_INTEGER,
        })
      ).records.flatMap((record) =>
        record.taskId ? [{ taskId: record.taskId.value }] : [],
      ),
    ),
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
