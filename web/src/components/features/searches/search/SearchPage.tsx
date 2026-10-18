import { useState } from 'react';
import { CandidateDetailOf } from '@/components/features/searches/search/CandidateDetailOf';
import { SearchCandidates } from '@/components/features/searches/search/SearchCandidates';
import { SearchFrontier } from '@/components/features/searches/search/SearchFrontier';
import { SearchHeading } from '@/components/features/searches/search/SearchHeading';
import { SearchTiles } from '@/components/features/searches/search/SearchTiles';
import { StopSearchButton } from '@/components/features/searches/search/StopSearchButton';
import { WhyItStalled } from '@/components/features/searches/search/WhyItStalled';
import { StationPane } from '@/components/features/stations/StationPane';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import {
  candidatesOf,
  incumbentOf,
  ongoing,
  reflectionsOf,
  type SearchDetail,
} from '@/lib/search';
import { TrailContext } from '@/lib/trail';

type SearchPageProps = {
  at: ReplayedStation;
  line: LineResponseDto | undefined;
  station: StationResponseDto | undefined;
  search: SearchDetail;
  number: number | null;
  set: ReplaySet | undefined;
  trail: BreadcrumbSegment[];
  forward: BreadcrumbSegment[];
};

export function SearchPage({
  at,
  line,
  station,
  search,
  number,
  set,
  trail,
  forward,
}: SearchPageProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen =
    candidatesOf(search).find((each) => each.candidateId === picked) ?? null;

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        bordered={false}
        actions={
          ongoing(search.state) && (
            <StopSearchButton teamId={at.teamId} searchId={search.id} />
          )
        }
      />

      <SearchHeading
        at={at}
        line={line}
        station={station}
        search={search}
        number={number}
        setName={set?.name ?? null}
      />

      <StationPane
        sidePanel={
          <CandidateDetailOf
            at={at}
            searchId={search.id}
            chosen={chosen}
            currency={search.budget.ceiling.currency}
            onClose={() => setPicked(null)}
          />
        }
      >
        <SearchTiles search={search} set={set} />

        {reflectionsOf(search).map((reflection) => (
          <WhyItStalled
            key={reflection.number}
            at={at}
            iteration={reflection}
            set={set}
            incumbent={incumbentOf(search, reflection)}
          />
        ))}

        <SearchCandidates
          at={at}
          search={search}
          picked={chosen?.candidateId ?? null}
          onPick={(id) => setPicked((was) => (was === id ? null : id))}
        />

        <SearchFrontier search={search} />
      </StationPane>
    </TrailContext>
  );
}
