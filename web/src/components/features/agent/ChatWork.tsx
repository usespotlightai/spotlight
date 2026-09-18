import { StepsDisclosure } from '@/components/features/inbox/conversation/StepsDisclosure';
import type { JournalStep } from '@/lib/inbox';

type ChatWorkProps = {
  steps: readonly JournalStep[];
  live: boolean;
};

export function ChatWork({ steps, live }: ChatWorkProps) {
  return (
    <StepsDisclosure
      steps={steps}
      live={live}
      label={
        <span>
          {live ? 'Working' : 'Worked'} · {steps.length}{' '}
          {steps.length === 1 ? 'step' : 'steps'}
        </span>
      }
    />
  );
}
