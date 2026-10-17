import { StationItemHeading } from '@/components/features/stations/StationItemHeading';
import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import type { ReplaySet } from '@/lib/replay';
import { STATION_GONE_FROM_LINE } from '@/lib/replay-words';
import { since } from '@/lib/since';

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
      title={set.name}
      marks={
        set.stationGone && (
          <Noted note={STATION_GONE}>
            <span className="flex">
              <Pill>Station gone</Pill>
            </span>
          </Noted>
        )
      }
    >
      {runs === 1 ? '1 run' : `${runs} runs`} · created {since(set.createdAt)}
    </StationItemHeading>
  );
}
