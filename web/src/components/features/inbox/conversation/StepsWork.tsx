import type { ReactElement } from 'react';

import { StepsDisclosure } from '@/components/features/inbox/conversation/StepsDisclosure';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import type { JournalStep } from '@/lib/inbox';

type StepsWorkProps = {
  steps: readonly JournalStep[];
  live: boolean;
};

const stepsLabel = (verb: string, count: number) => (
  <span className="flex flex-wrap items-center gap-x-3">
    <span>{verb}</span>{' '}
    <span>
      {count} {count === 1 ? 'step' : 'steps'}
    </span>
  </span>
);

export function StepsWork({ steps, live }: StepsWorkProps): ReactElement {
  return (
    <StepsDisclosure
      steps={steps}
      live={live}
      label={stepsLabel(live ? 'Working' : 'Worked', steps.length)}
    />
  );
}

export function StepsWorkPending({ count }: { count: number }): ReactElement {
  return (
    <div className="py-1.5" aria-busy="true">
      <DisclosureToggle
        open={false}
        onToggle={() => {}}
        disabled
        className="pointer-coarse:min-h-8"
      >
        {stepsLabel('Loading', count)}
      </DisclosureToggle>
    </div>
  );
}
