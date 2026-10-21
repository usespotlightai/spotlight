import { InboxStep } from '@/components/features/inbox/conversation/InboxStep';
import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import { useArrivals } from '@/hooks/useArrivals';
import { ARRIVING, type RunJournal } from '@/lib/inbox';
import type { ShownProgress } from '@/lib/run';

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
  const steps = journals.flatMap((each) => each.steps);
  const arrived = useArrivals(
    runId,
    steps.map((_, at) => at),
  );

  if (steps.length === 0 && !progress) {
    return null;
  }

  return (
    <ol className="-mx-1 flex flex-col gap-px">
      {steps.map((step, at) => (
        <InboxStep
          // biome-ignore lint/suspicious/noArrayIndexKey: the position of a step identifies it, because new steps go only at the end
          key={at}
          step={step}
          live={progress === 'in-progress'}
          className={arrived(at) ? ARRIVING : undefined}
        />
      ))}

      {progress && (
        <InboxWorking
          progress={progress}
          station={station.name}
          stationColor={station.color}
          stationPosition={station.position}
          stationCount={station.count}
        />
      )}
    </ol>
  );
}
