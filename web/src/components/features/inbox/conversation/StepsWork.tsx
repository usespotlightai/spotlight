import { StepsDisclosure } from '@/components/features/inbox/conversation/StepsDisclosure';
import type { JournalStep } from '@/lib/inbox';

type StepsWorkProps = {
  steps: readonly JournalStep[];
  live: boolean;
};

export function StepsWork({ steps, live }: StepsWorkProps) {
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
