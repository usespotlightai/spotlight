import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { InboxStep } from '@/components/features/inbox/conversation/InboxStep';
import { StepsFold } from '@/components/features/inbox/conversation/StepsFold';
import { FadingScroll } from '@/components/shared/FadingScroll';
import { useOpenWhenFocused } from '@/hooks/useOpenWhenFocused';
import type { JournalStep } from '@/lib/inbox';
import { useStepAnchors } from '@/lib/step-anchors';
import { cn } from '@/lib/utils';

type StepsDisclosureProps = {
  label: ReactNode;
  steps: readonly JournalStep[];
  live?: boolean;
  children?: ReactNode;
};

export function StepsDisclosure({
  label,
  steps,
  live = false,
  children,
}: StepsDisclosureProps) {
  const anchors = useStepAnchors();
  const holdsFocus = steps.some(
    (step) =>
      anchors.focused !== null && anchors.anchorOf(step) === anchors.focused,
  );

  const { open, toggle } = useOpenWhenFocused(holdsFocus);

  return (
    <div className="py-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1 rounded py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn(
            'size-3 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        {label}
      </button>

      {children}

      <StepsFold open={open}>
        <FadingScroll className="max-h-[min(18rem,50dvh)]">
          <ol className="flex flex-col gap-px pt-1">
            {steps.map((step, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are appended and never reordered, so where one sits is what names it
              <InboxStep key={at} step={step} live={live} />
            ))}
          </ol>
        </FadingScroll>
      </StepsFold>
    </div>
  );
}
