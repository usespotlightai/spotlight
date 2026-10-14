import type {
  InsightsReaderPort,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { TeamHistoryHeld } from '@outcomes/application/services/team-histories.service';
import { costCountsOf } from '@outcomes/domain/services/cost-breakdown';
import { flowCountsOf } from '@outcomes/domain/services/flow';
import { memoryCountsOf } from '@outcomes/domain/services/memory-comparison';
import { overviewCountsOf } from '@outcomes/domain/services/overview-counts';
import { peopleCountsOf } from '@outcomes/domain/services/people-counts';
import { pipelineCountsOf } from '@outcomes/domain/services/shipping';
import { teamCountsOf } from '@outcomes/domain/services/station-reports';
import {
  openingsOf,
  stationsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
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

const openingsFor = async (held: TeamHistoryHeld, history: TeamHistory) =>
  openingsOf(
    await held.touches.forTasks([
      ...history.failures.map((each) => each.taskId),
      ...history.deliveries.map((each) => each.taskId),
    ]),
  );

export const insightsReaderInMemory = (
  held: TeamHistoryHeld,
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
    const from = team.period.lookback.from;

    return overviewCountsOf(
      history,
      team.period,
      {
        from,
        lastRuns: await held.records.lastConfigRunsBefore(
          team.teamId,
          stationsOf(history.records).map(({ stationId }) => ({
            stationId,
            from,
          })),
        ),
      },
      await openingsFor(held, history),
    );
  },
  toolCounts: async (team) =>
    toolCountsOf(await historyOf(held, team), team.period.current),
  memoryCounts: async (team) =>
    memoryCountsOf(await historyOf(held, team), team.period.current),
});
