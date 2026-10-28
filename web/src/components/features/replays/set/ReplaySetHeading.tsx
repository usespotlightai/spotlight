import { StationItemHeading } from '@/components/features/stations/StationItemHeading';
import { Pill } from '@/components/shared/Pill';
import { WithTooltip } from '@/components/shared/WithTooltip';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import type { ReplaySet } from '@/lib/replay';
import {
  formatRefreshed,
  KEPT_BY_SPOTLIGHT,
  REPLAY_SET_TITLE,
  refreshNote,
  STATION_GONE_FROM_LINE,
} from '@/lib/replay-words';

const STATION_GONE = `${STATION_GONE_FROM_LINE} The set starts no replays, takes no runs and retains no workspaces.`;

type ReplaySetHeadingProps = {
  set: ReplaySet;
  line: LineResponseDto | undefined;
  station: StationResponseDto | undefined;
};

export function ReplaySetHeading({
  set,
  line,
  station,
}: ReplaySetHeadingProps) {
  const runs = set.entries.length;

  return (
    <StationItemHeading
      line={line}
      station={station}
      title={REPLAY_SET_TITLE}
      marks={
        set.stationGone && (
          <WithTooltip tooltip={STATION_GONE}>
            <span className="flex">
              <Pill>Station gone</Pill>
            </span>
          </WithTooltip>
        )
      }
    >
      {runs === 1 ? '1 run' : `${runs} runs`} ·{' '}
      <WithTooltip
        tooltip={refreshNote(set.lastRefresh)}
        named={KEPT_BY_SPOTLIGHT}
      >
        <span data-slot="set-refresh">
          {KEPT_BY_SPOTLIGHT}, {formatRefreshed(set.refreshedAt)}
        </span>
      </WithTooltip>
    </StationItemHeading>
  );
}
