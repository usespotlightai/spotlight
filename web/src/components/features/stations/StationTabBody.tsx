import { StationImproveTab } from '@/components/features/stations/improve/StationImproveTab';
import { StationOverviewTab } from '@/components/features/stations/overview/StationOverviewTab';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import type { StationTab } from '@/lib/station';

const ENDS = {
  backlog:
    'Tasks wait here until someone starts them. Nothing runs at a backlog. It has no harness and no prompt.',
  completed:
    'Tasks land here when the line is done with them. Nothing runs here.',
};

type StationTabBodyProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
  tab: StationTab;
};

export function StationTabBody({
  slug,
  teamId,
  line,
  station,
  tab,
}: StationTabBodyProps) {
  if (station.kind !== 'work') {
    return (
      <p className="text-muted-foreground text-sm leading-6">
        {ENDS[station.kind]}
      </p>
    );
  }

  return tab === 'overview' ? (
    <StationOverviewTab
      slug={slug}
      teamId={teamId}
      line={line}
      station={station}
    />
  ) : (
    <StationImproveTab
      slug={slug}
      teamId={teamId}
      line={line}
      station={station}
    />
  );
}
