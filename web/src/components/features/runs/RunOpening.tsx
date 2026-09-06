import type { ReactNode } from 'react';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import type { TeamRun } from '@/lib/run';
import { stationShare } from '@/lib/station';

type RunOpeningProps = {
  run: TeamRun;
  briefing: string | null;
  activity?: ReactNode;
};

export function RunOpening({ run, briefing, activity }: RunOpeningProps) {
  const station = run.station;
  const scroller = useStickToBottom<HTMLDivElement>();

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
        <TimeMarker at={run.startedAt} />

        <div className="mt-6">
          {briefing ? (
            <RunBriefing briefing={briefing} />
          ) : (
            <SaidCard>
              {station && (
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <StationIcon
                    share={stationShare(station.position, station.count)}
                    color={station.color}
                  />
                  {station.name}
                </span>
              )}

              <div>
                <h1 className="font-medium text-foreground text-sm leading-6">
                  {run.taskTitle}
                </h1>

                {run.taskDescription && (
                  <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-6">
                    {run.taskDescription}
                  </p>
                )}
              </div>
            </SaidCard>
          )}
        </div>

        {activity}
      </div>
    </div>
  );
}
