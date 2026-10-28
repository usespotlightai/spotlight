import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { StationItemHeading } from '@/components/features/stations/StationItemHeading';
import { Pill } from '@/components/shared/Pill';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import {
  formatCandidate,
  type ReplayDetail,
  type ReplayedStation,
  replaySetPath,
} from '@/lib/replay';
import {
  BASELINE_LABEL,
  BASELINE_NOTE,
  REPLAY_SET_TITLE,
} from '@/lib/replay-words';
import { searchPath } from '@/lib/search';
import { formatRan, since } from '@/lib/since';

const UNUSUAL: ReadonlySet<ReplayDetail['state']> = new Set([
  'stopped',
  'ceiling-reached',
]);

const LINK = 'text-foreground underline-offset-2 hover:underline';

type ReplayHeadingProps = {
  at: ReplayedStation;
  line: LineResponseDto | undefined;
  station: StationResponseDto | undefined;
  replay: ReplayDetail;
};

export function ReplayHeading({
  at,
  line,
  station,
  replay,
}: ReplayHeadingProps) {
  return (
    <StationItemHeading
      line={line}
      station={station}
      title={formatCandidate(replay.candidate)}
      marks={
        <>
          {UNUSUAL.has(replay.state) && (
            <ReplayStatePill state={replay.state} />
          )}
          {replay.isBaseline && (
            <WithTooltip tooltip={BASELINE_NOTE}>
              <span className="flex">
                <Pill>{BASELINE_LABEL}</Pill>
              </span>
            </WithTooltip>
          )}
        </>
      }
    >
      <TrailLink to={replaySetPath(at, replay.setId)} className={LINK}>
        {REPLAY_SET_TITLE}
      </TrailLink>
      {replay.search && (
        <>
          {' · '}
          <TrailLink
            to={searchPath(at, replay.search.searchId)}
            className={LINK}
          >
            from its search
          </TrailLink>
        </>
      )}
      {' · '}
      <WithTooltip tooltip={formatRan(replay.startedAt, replay.endedAt)}>
        <span>{since(replay.endedAt ?? replay.startedAt)}</span>
      </WithTooltip>
    </StationItemHeading>
  );
}
