import { SearchCandidates } from '@/components/features/searches/search/SearchCandidates';
import { SearchFrontier } from '@/components/features/searches/search/SearchFrontier';
import { SearchHeader } from '@/components/features/searches/search/SearchHeader';
import { SearchSplit } from '@/components/features/searches/search/SearchSplit';
import { StationLayout } from '@/components/features/stations/StationLayout';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import type { SearchDetail } from '@/lib/search';
import { TrailContext } from '@/lib/trail';

type SearchPageProps = {
  at: ReplayedStation;
  search: SearchDetail;
  number: number | null;
  set: ReplaySet | undefined;
  trail: BreadcrumbSegment[];
  forward: BreadcrumbSegment[];
};

export function SearchPage({
  at,
  search,
  number,
  set,
  trail,
  forward,
}: SearchPageProps) {
  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <StationLayout>
        <SearchHeader
          at={at}
          search={search}
          number={number}
          setName={set?.name ?? null}
        />

        <SearchSplit
          slug={at.slug}
          teamId={at.teamId}
          split={search.split}
          set={set}
        />

        <SearchFrontier search={search} />

        <SearchCandidates at={at} search={search} />
      </StationLayout>
    </TrailContext>
  );
}
