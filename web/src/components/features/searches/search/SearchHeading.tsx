import { SearchStatePill } from '@/components/features/searches/SearchStatePill';
import { StationItemHeading } from '@/components/features/stations/StationItemHeading';
import { INLINE_LINK } from '@/components/shared/section-link';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';
import { REPLAY_SET_TITLE } from '@/lib/replay-words';
import { type SearchDetail, searchLabel } from '@/lib/search';
import { formatRan, since } from '@/lib/since';

type SearchHeadingProps = {
  at: ReplayedStation;
  line: LineResponseDto | undefined;
  station: StationResponseDto | undefined;
  search: SearchDetail;
  number: number | null;
};

export function SearchHeading({
  at,
  line,
  station,
  search,
  number,
}: SearchHeadingProps) {
  return (
    <StationItemHeading
      line={line}
      station={station}
      title={searchLabel(number)}
      marks={<SearchStatePill stopReason={search.stopReason} />}
    >
      <TrailLink to={replaySetPath(at, search.setId)} className={INLINE_LINK}>
        {REPLAY_SET_TITLE}
      </TrailLink>
      {' · '}
      <WithTooltip tooltip={formatRan(search.startedAt, search.endedAt)}>
        <span>{since(search.endedAt ?? search.startedAt)}</span>
      </WithTooltip>
    </StationItemHeading>
  );
}
