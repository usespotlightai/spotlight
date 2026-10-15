import { InboxStep } from '@/components/features/inbox/conversation/InboxStep';
import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import type { RunJournal } from '@/lib/inbox';

type Station = {
  name: string;
  color: string;
  position: number;
  count: number;
};

type RunActivityProps = {
  journals: readonly RunJournal[];
  working: boolean;
  station: Station;
};

export function RunActivity({ journals, working, station }: RunActivityProps) {
  const steps = journals.flatMap((each) => each.steps);

  if (steps.length === 0 && !working) {
    return null;
  }

  return (
    <ol className="-mx-1 flex flex-col gap-px">
      {steps.map((step, at) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the position of a step identifies it, because new steps go only at the end
        <InboxStep key={at} step={step} live={working} />
      ))}

      {working && (
        <InboxWorking
          station={station.name}
          stationColor={station.color}
          stationPosition={station.position}
          stationCount={station.count}
        />
      )}
    </ol>
  );
}
