import { StepsDisclosure } from '@/components/features/inbox/conversation/StepsDisclosure';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import type { JournalStep } from '@/lib/inbox';

type StepsWorkProps = {
  steps: readonly JournalStep[];
  live: boolean;
};

const stepsLabel = (verb: string, count: number) => (
  <span>
    {verb} · {count} {count === 1 ? 'step' : 'steps'}
  </span>
);

export function StepsWork({ steps, live }: StepsWorkProps) {
  return (
    <StepsDisclosure
      steps={steps}
      live={live}
      label={stepsLabel(live ? 'Working' : 'Worked', steps.length)}
    />
  );
}

export function StepsWorkPending({ count }: { count: number }) {
  return (
    <div className="py-1.5" aria-busy="true">
      <DisclosureToggle open={false} onToggle={() => {}} disabled>
        {stepsLabel('Loading', count)}
      </DisclosureToggle>
    </div>
  );
}
