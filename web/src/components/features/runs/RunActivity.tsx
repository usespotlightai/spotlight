import { InboxStep } from '@/components/features/inbox/conversation/InboxStep';
import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import { StepsWork } from '@/components/features/inbox/conversation/StepsWork';
import { useArrivals } from '@/hooks/useArrivals';
import { ARRIVING, liveSessionOf, type RunJournal } from '@/lib/inbox';
import { stretchesOf } from '@/lib/journal-step';
import type { ShownProgress } from '@/lib/run';
import { cn } from '@/lib/utils';

type Station = {
  name: string;
  color: string;
  position: number;
  count: number;
};

type RunActivityProps = {
  runId: string;
  journals: readonly RunJournal[];
  progress: ShownProgress | null;
  station: Station;
};

export function RunActivity({
  runId,
  journals,
  progress,
  station,
}: RunActivityProps) {
  const stretches = stretchesOf(journals.flatMap((each) => each.steps));
  const arrived = useArrivals(
    runId,
    stretches.map((stretch) => stretch.at),
  );

  if (stretches.length === 0 && !progress) {
    return null;
  }

  return (
    <ol className="-mx-1 flex flex-col gap-1">
      {stretches.map((stretch, place) => {
        const arriving = arrived(stretch.at) ? ARRIVING : undefined;

        return stretch.kind === 'said' ? (
          <InboxStep
            key={stretch.at}
            step={stretch.step}
            className={arriving}
          />
        ) : (
          <li key={stretch.at} className={cn('px-1', arriving)}>
            <StepsWork
              steps={stretch.steps}
              live={
                progress === 'in-progress' && place === stretches.length - 1
              }
            />
          </li>
        );
      })}

      {progress && (
        <InboxWorking
          progress={progress}
          station={station.name}
          stationColor={station.color}
          stationPosition={station.position}
          stationCount={station.count}
          session={liveSessionOf(journals)}
        />
      )}
    </ol>
  );
}
