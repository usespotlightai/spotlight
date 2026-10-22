import { useSearchParams } from 'react-router';
import { RunsFilters } from '@/components/features/insights/RunsFilters';
import { useInsightsTraces } from '@/hooks/api/useInsightsTraces';
import { useLines } from '@/hooks/api/useLines';
import { paramsOf, stationNamesOf, viewOf } from '@/lib/insights';

export function TracesFilters({ teamId }: { teamId: string }) {
  const [params, setParams] = useSearchParams();
  const view = viewOf(params);
  const lines = useLines(teamId).data ?? [];
  const traces = useInsightsTraces(teamId, view.period, view.filter);

  return (
    <RunsFilters
      filter={view.filter}
      names={stationNamesOf(lines)}
      lines={lines}
      people={traces.data?.people ?? []}
      onChange={(filter) =>
        setParams(paramsOf({ ...view, filter, page: 1 }), { replace: true })
      }
    />
  );
}
