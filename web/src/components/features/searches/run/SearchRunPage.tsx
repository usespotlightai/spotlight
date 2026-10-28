import { AutonomousComposer } from '@/components/features/runs/AutonomousComposer';
import { UntaskedRun } from '@/components/features/runs/UntaskedRun';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useLines } from '@/hooks/api/useLines';
import { useSearches } from '@/hooks/api/useSearches';
import { useStationTrail } from '@/hooks/useStationTrail';
import { failureSentence } from '@/lib/replay-words';
import { iterationTitle, type SearchRun, searchNumber } from '@/lib/search';
import { searchCrumbs } from '@/lib/station-crumbs';
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

  const search = searches.data?.find((each) => each.id === run.searchId);
  const base: BreadcrumbSegment[] = [
    ...stationTrail,
    ...searchCrumbs(
      at,
      { id: run.searchId, setId: search?.setId ?? null },
      number,
    ),
    { label: `Iteration ${run.iteration}` },
  ];
  const { trail, forward } = useTrail(base);

  return (
    <UntaskedRun
      slug={slug}
      teamId={teamId}
      trail={trail}
      forward={forward}
      run={run}
      threadBriefing={null}
      title={iterationTitle(run.iteration, number)}
      briefing={run.briefing}
      failure={run.failure ? failureSentence(run.failure) : null}
      footer={<AutonomousComposer slug={slug} agent={run.agent} />}
    />
  );
}
