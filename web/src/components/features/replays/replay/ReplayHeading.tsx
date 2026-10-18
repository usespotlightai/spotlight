import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { StationItemHeading } from '@/components/features/stations/StationItemHeading';
import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import {
  formatCandidate,
  type ReplayDetail,
  type ReplayedStation,
  replaySetPath,
} from '@/lib/replay';
import { BASELINE_LABEL, BASELINE_NOTE } from '@/lib/replay-words';
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
  setName: string | null;
};

export function ReplayHeading({
  at,
  line,
  station,
  replay,
  setName,
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
            <Noted note={BASELINE_NOTE}>
              <span className="flex">
                <Pill>{BASELINE_LABEL}</Pill>
              </span>
            </Noted>
          )}
        </>
      }
    >
      <TrailLink to={replaySetPath(at, replay.setId)} className={LINK}>
        {setName ?? 'Its set'}
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
      <Noted note={formatRan(replay.startedAt, replay.endedAt)}>
        <span>{since(replay.endedAt ?? replay.startedAt)}</span>
      </Noted>
    </StationItemHeading>
  );
}
