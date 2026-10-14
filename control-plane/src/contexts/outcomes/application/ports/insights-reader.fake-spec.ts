import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { TeamHistoryHeld } from '@outcomes/application/services/team-histories.service';
import { teamCountsOf } from '@outcomes/domain/services/station-reports';

const ALL = Number.MAX_SAFE_INTEGER;

export const insightsReaderInMemory = (
  held: TeamHistoryHeld,
): InsightsReaderPort => ({
  stationCounts: async ({ workspaceId, teamId, period }) => {
    const window = { workspaceId, teamId, ...period.lookback };
    const failures = await held.failures.ofTeamBetween(window, ALL);

    return teamCountsOf(
      {
        records: await held.records.endedForTeam(window, ALL),
        deliveries: await held.deliveries.ofTeamBetween(window, ALL),
        touches: await held.touches.forTasks(
          failures.map((each) => each.taskId),
        ),
        failures,
        chats: [],
      },
      period,
    );
  },
});
