import type { ReactElement } from 'react';

import {
  ACTIVITY_LAYOUT,
  StationActivity,
} from '@/components/features/stations/activity/StationActivity';
import { StationConfig } from '@/components/features/stations/config/StationConfig';
import { JudgeAgreement } from '@/components/features/stations/judge/JudgeAgreement';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { NO_JUDGE } from '@/lib/judge';
import type { StationTab } from '@/lib/station';

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
  tab: StationTab;
};

export function StationBody({
  slug,
  teamId,
  line,
  station,
  tab,
}: StationBodyProps): ReactElement {
  if (station.kind !== 'work') {
    return (
      <p className="text-muted-foreground text-sm leading-6">
        {ENDS[station.kind]}
      </p>
    );
  }

  if (tab === 'judge') {
    return (
      <div className={ACTIVITY_LAYOUT}>
        {station.judge ? (
          <JudgeAgreement
            slug={slug}
            teamId={teamId}
            lineId={line.id}
            stationId={station.id}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{NO_JUDGE}</p>
        )}
      </div>
    );
  }

  return tab === 'config' ? (
    <StationConfig slug={slug} teamId={teamId} line={line} station={station} />
  ) : (
    <StationActivity
      slug={slug}
      teamId={teamId}
      line={line}
      station={station}
    />
  );
}
