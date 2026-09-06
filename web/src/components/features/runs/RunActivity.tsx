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
    <ol className="mt-6 flex flex-col gap-px">
      {steps.map((step, at) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps are appended and never reordered, so where one sits is what names it
        <InboxStep key={at} step={step} />
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
