import {
  type QueryExecuteOptions,
  type QueryClient,
  QueryClientContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

import { insightsAgentConfigsQuery } from '@/hooks/api/useInsightsAgentConfigs';
import { insightsCandidatesQuery } from '@/hooks/api/useInsightsCandidates';
import { insightsChangesQuery } from '@/hooks/api/useInsightsChanges';
import { insightsCostQuery } from '@/hooks/api/useInsightsCost';
import { insightsFlowQuery } from '@/hooks/api/useInsightsFlow';
import { insightsMemoryQuery } from '@/hooks/api/useInsightsMemory';
import { insightsOverviewQuery } from '@/hooks/api/useInsightsOverview';
import { insightsPeopleQuery } from '@/hooks/api/useInsightsPeople';
import { insightsPullRequestListQuery } from '@/hooks/api/useInsightsPullRequestList';
import { insightsPullRequestsQuery } from '@/hooks/api/useInsightsPullRequests';
import { insightsShippingQuery } from '@/hooks/api/useInsightsShipping';
import { insightsStationsQuery } from '@/hooks/api/useInsightsStations';
import { insightsToolsQuery } from '@/hooks/api/useInsightsTools';
import { insightsTracesQuery } from '@/hooks/api/useInsightsTraces';
import type { InsightsPeriod, InsightsTab } from '@/lib/insights';
import { EVERY_AGENT_CONFIG } from '@/lib/insights-changes';

type Warm = (client: QueryClient) => void;

const warm =
  <T, K extends QueryKey>(
    query: QueryExecuteOptions<T, Error, T, T, K>,
  ): Warm =>
  (client) => {
    if (client.getQueryData(query.queryKey) === undefined) {
      client.query(query).catch(() => undefined);
    }
  };

// What each tab reads when it opens with no filter, on its first page.
const queriesOf = (
  tab: InsightsTab,
  teamId: string,
  period: InsightsPeriod,
): Warm[] => {
  switch (tab) {
    case 'overview':
      return [warm(insightsOverviewQuery(teamId, period))];
    case 'cost':
      return [warm(insightsCostQuery(teamId, period))];
    case 'people':
      return [warm(insightsPeopleQuery(teamId, period))];
    case 'productivity':
      return [
        warm(insightsFlowQuery(teamId, period)),
        warm(insightsShippingQuery(teamId, period)),
        warm(insightsPullRequestsQuery(teamId, period)),
        warm(insightsPullRequestListQuery(teamId, period, {}, 1)),
      ];
    case 'stations':
      return [
        warm(insightsStationsQuery(teamId, period)),
        warm(insightsChangesQuery(teamId, period)),
        warm(insightsCandidatesQuery(teamId, period)),
        warm(insightsAgentConfigsQuery(teamId, period, EVERY_AGENT_CONFIG)),
      ];
    case 'tools':
      return [
        warm(insightsToolsQuery(teamId, period)),
        warm(insightsMemoryQuery(teamId, period)),
      ];
    case 'traces':
      return [warm(insightsTracesQuery(teamId, period, {}))];
  }
};

// Starts loading a tab's data when it is about to be opened, so it opens with its content.
export function usePrefetchInsightsTab(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  // No client outside a QueryClientProvider (stories, isolated tests): nothing to warm.
  const client = useContext(QueryClientContext);

  return useCallback(
    (tab: InsightsTab) => {
      if (!client || !teamId) {
        return;
      }

      for (const each of queriesOf(tab, teamId, period)) {
        each(client);
      }
    },
    [client, teamId, period],
  );
}
