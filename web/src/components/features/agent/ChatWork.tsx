import { StepsDisclosure } from '@/components/features/inbox/conversation/StepsDisclosure';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import type { JournalStep } from '@/lib/inbox';
import { stepsCounted } from '@/lib/turns';

type ChatWorkProps = {
  steps: readonly JournalStep[];
  live: boolean;
};

const stepsLabel = (verb: string, count: number) => (
  <span>
    {verb} · {stepsCounted(count)}
  </span>
);

export function ChatWork({ steps, live }: ChatWorkProps) {
  return (
    <StepsDisclosure
      steps={steps}
      live={live}
      label={stepsLabel(live ? 'Working' : 'Worked', steps.length)}
    />
  );
}

export function ChatWorkPending({ count }: { count: number }) {
  return (
    <div className="py-1.5" aria-busy="true">
      <DisclosureToggle open={false} onToggle={() => {}} disabled>
        {stepsLabel('Loading', count)}
      </DisclosureToggle>
    </div>
  );
}
