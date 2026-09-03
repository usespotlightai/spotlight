import { StationIcon } from '@/components/board/StationIcon';
import { InboxWorking } from '@/components/inbox/InboxWorking';
import { SaidCard } from '@/components/inbox/SaidCard';
import { TimeMarker } from '@/components/inbox/TimeMarker';
import { RunBriefing } from '@/components/runs/RunBriefing';
import { type TeamRun, working } from '@/lib/run';
import { stationShare } from '@/lib/station';

type RunOpeningProps = {
  run: TeamRun;
  briefing: string | null;
};

export function RunOpening({ run, briefing }: RunOpeningProps) {
  const station = run.station;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
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

        {working(run) && station && (
          <ol className="mt-6">
            <InboxWorking
              station={station.name}
              stationColor={station.color}
              stationPosition={station.position}
              stationCount={station.count}
            />
          </ol>
        )}
      </div>
    </div>
  );
}
