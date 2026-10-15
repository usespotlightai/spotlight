import type {
  InsightsReaderPort,
  PullRequestReach,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { TeamHistoryHeld } from '@outcomes/application/services/team-histories.service';
import { ScoresInMemory } from '@outcomes/domain/judging.fake-spec';
import {
  PullRequestRecordsInMemory,
  TaskChangeShapesInMemory,
} from '@outcomes/domain/pull-requests.fake-spec';
import type { PullRequestRecordRepository } from '@outcomes/domain/repositories/pull-request-record.repository';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import type { TaskChangeShapeRepository } from '@outcomes/domain/repositories/task-change-shape.repository';
import { changeCountsOf } from '@outcomes/domain/services/before-after';
import type { CarriedConfigs } from '@outcomes/domain/services/config-stretches';
import { costCountsOf } from '@outcomes/domain/services/cost-breakdown';
import { flowCountsOf } from '@outcomes/domain/services/flow';
import { judgedRunsOf } from '@outcomes/domain/services/judge-shares';
import { memoryCountsOf } from '@outcomes/domain/services/memory-comparison';
import { overviewCountsOf } from '@outcomes/domain/services/overview-counts';
import { peopleCountsOf } from '@outcomes/domain/services/people-counts';
import { filteredPullRequests } from '@outcomes/domain/services/pull-request-filter';
import { pullRequestCountsOf } from '@outcomes/domain/services/pull-request-insights';
import { inEndOrder } from '@outcomes/domain/services/run-order';
import {
  setupCountsOf,
  setupRunsWithin,
} from '@outcomes/domain/services/setup-comparison';
import { pipelineCountsOf } from '@outcomes/domain/services/shipping';
import { teamCountsOf } from '@outcomes/domain/services/station-reports';
import {
  openingsOf,
  stationsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import {
  type TeamPullRequest,
  teamPullRequestOf,
} from '@outcomes/domain/services/team-pull-requests';
import { toolCountsOf } from '@outcomes/domain/services/tool-insights';

const ALL = Number.MAX_SAFE_INTEGER;

const historyOf = async (
  held: TeamHistoryHeld,
  { workspaceId, teamId, period }: TeamInPeriod,
): Promise<TeamHistory> => {
  const window = { workspaceId, teamId, ...period.lookback };

  return {
    records: await held.records.endedForTeam(window, ALL),
    deliveries: await held.deliveries.ofTeamBetween(window, ALL),
    touches: await held.touches.ofTeamBetween(window, ALL),
    failures: await held.failures.ofTeamBetween(window, ALL),
    chats: await held.chats.ofTeamBetween(window, ALL),
  };
};

const carriedOf = async (
  held: TeamHistoryHeld,
  team: TeamInPeriod,
  history: TeamHistory,
): Promise<CarriedConfigs> => {
  const from = team.period.lookback.from;

  return {
    from,
    lastRuns: await held.records.lastConfigRunsBefore(
      team.teamId,
      stationsOf(history.records).map(({ stationId }) => ({ stationId, from })),
    ),
  };
};

const openingsFor = async (held: TeamHistoryHeld, history: TeamHistory) =>
  openingsOf(
    await held.touches.forTasks([
      ...history.failures.map((each) => each.taskId),
      ...history.deliveries.map((each) => each.taskId),
    ]),
  );

export interface PullRequestsHeld {
  readonly records: PullRequestRecordRepository;
  readonly shapes: TaskChangeShapeRepository;
}

export const pullRequestsHeldIn = async (
  runs: RunRecordRepository,
  pullRequests: PullRequestsHeld,
  { workspaceId, teamId, period }: TeamInPeriod,
  reach: PullRequestReach,
): Promise<readonly TeamPullRequest[]> => {
  const records = await pullRequests.records.seenForTeamBetween(
    {
      workspaceId,
      teamId,
      repositories: reach.repositories,
      from: reach.from,
      to: period.current.to,
    },
    reach.most,
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
    const view = teamPullRequestOf(
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

const currentReach = (
  team: TeamInPeriod,
  repositories: readonly string[],
): PullRequestReach => ({
  repositories,
  from: team.period.current.from,
  most: Number.MAX_SAFE_INTEGER,
});

export const insightsReaderInMemory = (
  held: TeamHistoryHeld,
  scores: ScoreRepository = new ScoresInMemory(),
  pullRequests: PullRequestsHeld = {
    records: new PullRequestRecordsInMemory(),
    shapes: new TaskChangeShapesInMemory(),
  },
): InsightsReaderPort => ({
  stationCounts: async (team) => {
    const history = await historyOf(held, team);

    return teamCountsOf(
      {
        ...history,
        touches: [...(await openingsFor(held, history)).values()],
      },
      team.period,
    );
  },
  costCounts: async (team) => {
    const history = await historyOf(held, team);

    return {
      current: costCountsOf(history, team.period.current),
      spendBefore: costCountsOf(history, team.period.previous).spend,
    };
  },
  flowCounts: async (team) => {
    const history = await historyOf(held, team);

    return flowCountsOf(history, team.period, await openingsFor(held, history));
  },
  peopleCounts: async (team) =>
    peopleCountsOf(await historyOf(held, team), team.period),
  pipelineCounts: async (team, taskIds) =>
    pipelineCountsOf(await historyOf(held, team), taskIds, team.period),
  overviewCounts: async (team) => {
    const history = await historyOf(held, team);

    return overviewCountsOf(
      history,
      team.period,
      await carriedOf(held, team, history),
      await openingsFor(held, history),
    );
  },
  toolCounts: async (team) =>
    toolCountsOf(await historyOf(held, team), team.period.current),
  memoryCounts: async (team) =>
    memoryCountsOf(await historyOf(held, team), team.period.current),
  setupCounts: async (team, filter) => {
    const history = await historyOf(held, team);
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
    const history = await historyOf(held, team);

    return changeCountsOf(
      history,
      team.period,
      await carriedOf(held, team, history),
      await scores.ofRuns(history.records.map((each) => each.runId)),
    );
  },
  pullRequests: (team, reach) =>
    pullRequestsHeldIn(held.records, pullRequests, team, reach),
  pullRequestCounts: async (team, repositories) =>
    pullRequestCountsOf(
      await pullRequestsHeldIn(
        held.records,
        pullRequests,
        team,
        currentReach(team, repositories),
      ),
      team.period.current,
    ),
  pullRequestPage: async (team, { repositories, filter, page, size }) => {
    const listed = filteredPullRequests(
      await pullRequestsHeldIn(
        held.records,
        pullRequests,
        team,
        currentReach(team, repositories),
      ),
      filter,
      team.period.current,
    );

    return {
      total: listed.length,
      pullRequests: listed.slice((page - 1) * size, page * size),
    };
  },
});
