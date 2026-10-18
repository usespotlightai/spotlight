import { StepBody } from '@/components/features/inbox/conversation/StepBody';
import { StepHead } from '@/components/features/inbox/conversation/StepHead';
import { Collapsible } from '@/components/shared/Collapsible';
import { useOpenWhenFocused } from '@/hooks/useOpenWhenFocused';
import type { JournalStep } from '@/lib/inbox';
import { shownStep, stillRunning } from '@/lib/journal-step';
import { cn } from '@/lib/utils';

const ROW =
  'flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs leading-6';

type ExpandableStepProps = {
  step: JournalStep;
  live: boolean;
  focused: boolean;
};

export function ExpandableStep({ step, live, focused }: ExpandableStepProps) {
  const { open, toggle } = useOpenWhenFocused(focused);
  const shown = shownStep(step);
  const expandable = Boolean(shown.body);

  const head = (
    <StepHead
      shown={shown}
      running={stillRunning(step, live)}
      failed={step.status === 'failed'}
      open={open}
      expandable={expandable}
    />
  );

  if (!expandable) {
    return <div className={ROW}>{head}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          ROW,
          'cursor-pointer outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
        )}
      >
        {head}
      </button>

      <Collapsible open={open} appear={false}>
        <StepBody shown={shown} command={step.text} />
      </Collapsible>
    </>
  );
}
