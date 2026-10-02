import { RunSpend } from '@/components/features/runs/RunSpend';
import { UntaskedRun } from '@/components/features/runs/UntaskedRun';
import { SearchRunBanner } from '@/components/features/searches/run/SearchRunBanner';
import { SearchRunFooter } from '@/components/features/searches/run/SearchRunFooter';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useLines } from '@/hooks/api/useLines';
import { useSearches } from '@/hooks/api/useSearches';
import { useStationTrail } from '@/hooks/useStationTrail';
import {
  type SearchRun,
  searchLabel,
  searchNumber,
  searchPath,
} from '@/lib/search';
import { useTrail } from '@/lib/trail';

type SearchRunPageProps = {
  slug: string;
  teamId: string;
  run: SearchRun;
};

export function SearchRunPage({ slug, teamId, run }: SearchRunPageProps) {
  const lines = useLines(teamId);
  const stationId = run.station?.id;
  const line = lines.data?.find((each) =>
    each.stations.some((station) => station.id === stationId),
  );
  const at =
    line && stationId ? { slug, teamId, lineId: line.id, stationId } : null;
  const stationTrail = useStationTrail({
    slug,
    teamId,
    lineId: line?.id,
    stationId,
  });
  const searches = useSearches(teamId, line?.id, stationId);
  const number = searchNumber(searches.data ?? [], run.searchId);

  const base: BreadcrumbSegment[] = [
    ...stationTrail,
    ...(at
      ? [{ label: searchLabel(number), to: searchPath(at, run.searchId) }]
      : []),
    { label: `Iteration ${run.iteration}` },
  ];
  const { trail, forward } = useTrail(base);

  return (
    <UntaskedRun
      trail={trail}
      forward={forward}
      run={run}
      banner={<SearchRunBanner at={at} run={run} number={number} />}
      details={<RunSpend spend={run.spend} />}
      idleNote={
        run.state === 'failed'
          ? 'This iteration failed before its agent did any work.'
          : 'This iteration ended before its agent did any work.'
      }
      footer={<SearchRunFooter />}
    />
  );
}
