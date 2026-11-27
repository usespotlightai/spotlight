import {
  type QueryExecuteOptions,
  type QueryClient,
  QueryClientContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

import { insightsCostQuery } from '@/hooks/api/useInsightsCost';
import { insightsFlowQuery } from '@/hooks/api/useInsightsFlow';
import { insightsOverviewQuery } from '@/hooks/api/useInsightsOverview';
import { insightsPeopleQuery } from '@/hooks/api/useInsightsPeople';
import { insightsStationsQuery } from '@/hooks/api/useInsightsStations';
import { insightsToolsQuery } from '@/hooks/api/useInsightsTools';
import { insightsTracesQuery } from '@/hooks/api/useInsightsTraces';
import type { InsightsPeriod, InsightsTab } from '@/lib/insights';

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

const queryOf = (
  tab: InsightsTab,
  teamId: string,
  period: InsightsPeriod,
): Warm => {
  switch (tab) {
    case 'overview':
      return warm(insightsOverviewQuery(teamId, period));
    case 'cost':
      return warm(insightsCostQuery(teamId, period));
    case 'people':
      return warm(insightsPeopleQuery(teamId, period));
    case 'productivity':
      return warm(insightsFlowQuery(teamId, period));
    case 'stations':
      return warm(insightsStationsQuery(teamId, period));
    case 'tools':
      return warm(insightsToolsQuery(teamId, period));
    case 'traces':
      return warm(insightsTracesQuery(teamId, period, {}));
  }
};

export function usePrefetchInsightsTab(
  teamId: string | undefined,
  period: InsightsPeriod,
): (tab: InsightsTab) => void {
  const client = useContext(QueryClientContext);

  return useCallback(
    (tab: InsightsTab) => {
      if (!client || teamId === undefined || teamId === '') {
        return;
      }

      queryOf(tab, teamId, period)(client);
    },
    [client, teamId, period],
  );
}
