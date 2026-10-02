import { useParams } from 'react-router';
import { SearchCandidates } from '@/components/features/searches/search/SearchCandidates';
import { SearchFrontier } from '@/components/features/searches/search/SearchFrontier';
import { SearchHeader } from '@/components/features/searches/search/SearchHeader';
import { SearchSkeleton } from '@/components/features/searches/search/SearchSkeleton';
import { SearchSplit } from '@/components/features/searches/search/SearchSplit';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import { useTeamReplaySets } from '@/hooks/api/useReplaySets';
import { useSearch } from '@/hooks/api/useSearch';
import { useSearches } from '@/hooks/api/useSearches';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { useStationTrail } from '@/hooks/useStationTrail';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import {
  searchesAnchorPath,
  searchLabel,
  searchNumber,
  searchPath,
} from '@/lib/search';
import { TrailContext, useTrail } from '@/lib/trail';
import { cn } from '@/lib/utils';

export function Search() {
  const { slug, teamId, lineId, stationId, searchId } = useParams();
  const stationTrail = useStationTrail({ slug, teamId, lineId, stationId });
  const search = useSearch(teamId, searchId);
  const searches = useSearches(teamId, lineId, stationId);
  const sets = useTeamReplaySets(teamId);

  const at =
    slug && teamId && lineId && stationId
      ? { slug, teamId, lineId, stationId }
      : null;
  const found =
    search.data?.lineId === lineId && search.data?.stationId === stationId
      ? search.data
      : undefined;
  const number = searchId ? searchNumber(searches.data ?? [], searchId) : null;
  const set = sets.data?.find((each) => each.id === found?.setId);

  const base: BreadcrumbSegment[] = [
    ...stationTrail,
    ...(found && at
      ? [{ label: searchLabel(number), to: searchPath(at, found.id) }]
      : []),
  ];
  const { trail, forward } = useTrail(base);
  useScrollToHash(Boolean(found && at));

  if (loading(search)) {
    return <SearchSkeleton known={trail} />;
  }

  if (failed(search) && !(notFound(search.error) && sets.data)) {
    return (
      <PageNotice>
        {notFound(search.error) ? (
          <MembersOnly title="Only the team’s members can see its searches" />
        ) : (
          <CouldNotLoad
            what="The search"
            retrying={search.isFetching}
            onRetry={() => void search.refetch()}
          />
        )}
      </PageNotice>
    );
  }

  if (!found || !at) {
    return (
      <PageNotice title="Search not found">
        <p className="text-muted-foreground text-sm">
          There is no search at that address. It may belong to another station.
        </p>
        {at && (
          <TrailLink
            to={searchesAnchorPath(at)}
            className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
          >
            See the station’s searches
          </TrailLink>
        )}
      </PageNotice>
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <StationLayout>
        <SearchHeader
          at={at}
          search={found}
          number={number}
          setName={set?.name ?? null}
        />

        <SearchSplit
          slug={at.slug}
          teamId={at.teamId}
          split={found.split}
          set={set}
        />

        <SearchFrontier search={found} />

        <SearchCandidates at={at} search={found} />
      </StationLayout>
    </TrailContext>
  );
}
