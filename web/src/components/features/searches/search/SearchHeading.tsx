import { SearchStatePill } from '@/components/features/searches/SearchStatePill';
import { StationItemHeading } from '@/components/features/stations/StationItemHeading';
import { Noted } from '@/components/shared/Noted';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';
import { type SearchDetail, searchLabel } from '@/lib/search';
import { formatRan, since } from '@/lib/since';

type SearchHeadingProps = {
  at: ReplayedStation;
  line: LineResponseDto | undefined;
  station: StationResponseDto | undefined;
  search: SearchDetail;
  number: number | null;
  setName: string | null;
};

export function SearchHeading({
  at,
  line,
  station,
  search,
  number,
  setName,
}: SearchHeadingProps) {
  return (
    <StationItemHeading
      line={line}
      station={station}
      title={searchLabel(number)}
      marks={<SearchStatePill ending={search.ending} />}
    >
      <TrailLink
        to={replaySetPath(at, search.setId)}
        className="text-foreground underline-offset-2 hover:underline"
      >
        {setName ?? 'Its replay set'}
      </TrailLink>
      {' · '}
      <Noted note={formatRan(search.startedAt, search.endedAt)}>
        <span>{since(search.endedAt ?? search.startedAt)}</span>
      </Noted>
    </StationItemHeading>
  );
}
