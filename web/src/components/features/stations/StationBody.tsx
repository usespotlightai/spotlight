import { StationOverview } from '@/components/features/stations/overview/StationOverview';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

const ENDS = {
  backlog:
    'Tasks wait here until someone starts them. Nothing runs at a backlog. It has no harness and no prompt.',
  completed:
    'Tasks land here when the line is done with them. Nothing runs here.',
};

type StationBodyProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationBody({ slug, teamId, line, station }: StationBodyProps) {
  if (station.kind !== 'work') {
    return (
      <p className="text-muted-foreground text-sm leading-6">
        {ENDS[station.kind]}
      </p>
    );
  }

  return (
    <StationOverview
      slug={slug}
      teamId={teamId}
      line={line}
      station={station}
    />
  );
}
