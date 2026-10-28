import { useParams } from 'react-router';
import { SearchNotFound } from '@/components/features/searches/search/SearchNotFound';
import { SearchPage } from '@/components/features/searches/search/SearchPage';
import { SearchSkeleton } from '@/components/features/searches/search/SearchSkeleton';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useTeamReplaySets } from '@/hooks/api/useReplaySet';
import { useSearch } from '@/hooks/api/useSearch';
import { useSearches } from '@/hooks/api/useSearches';
import { useStation } from '@/hooks/api/useStation';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { useStationTrail } from '@/hooks/useStationTrail';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { replayedStationOf } from '@/lib/replayed-station';
import { searchNumber } from '@/lib/search';
import { searchCrumbs } from '@/lib/station-crumbs';
import { useTrail } from '@/lib/trail';

export function Search() {
  const { slug, teamId, lineId, stationId, searchId } = useParams();
  const stationTrail = useStationTrail({ slug, teamId, lineId, stationId });
  const search = useSearch(teamId, searchId);
  const searches = useSearches(teamId, lineId, stationId);
  const sets = useTeamReplaySets(teamId);
  const { line, station } = useStation(teamId, lineId, stationId);

  const at = replayedStationOf({ slug, teamId, lineId, stationId });
  const found =
    search.data?.lineId === lineId && search.data?.stationId === stationId
      ? search.data
      : undefined;
  const number = searchId ? searchNumber(searches.data ?? [], searchId) : null;
  const set = sets.data?.find((each) => each.id === found?.setId);
  const { trail, forward } = useTrail([
    ...stationTrail,
    ...searchCrumbs(at, found, number),
  ]);
  useScrollToHash(Boolean(found && at));

  if (loading(search)) {
    return <SearchSkeleton known={trail} />;
  }

  if (failed(search) && !(notFound(search.error) && sets.data)) {
    return (
      <PageNotice>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only team members can see its searches"
          what="The search"
          query={search}
        />
      </PageNotice>
    );
  }

  if (!found || !at) {
    return <SearchNotFound at={at} />;
  }

  return (
    <SearchPage
      at={at}
      line={line}
      station={station}
      search={found}
      number={number}
      set={set}
      trail={trail}
      forward={forward}
    />
  );
}
