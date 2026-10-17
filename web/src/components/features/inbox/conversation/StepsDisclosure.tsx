import type { ReactNode } from 'react';
import { InboxStep } from '@/components/features/inbox/conversation/InboxStep';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import { FadingScroll } from '@/components/shared/FadingScroll';
import { Unfold } from '@/components/shared/Unfold';
import { useOpenWhenFocused } from '@/hooks/useOpenWhenFocused';
import type { JournalStep } from '@/lib/inbox';
import { useStepAnchors } from '@/lib/step-anchors';

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
  const hasFocus = steps.some(
    (step) =>
      anchors.focused !== null && anchors.anchorOf(step) === anchors.focused,
  );

  const { open, toggle } = useOpenWhenFocused(hasFocus);

  return (
    <div className="py-1.5">
      <DisclosureToggle open={open} onToggle={toggle}>
        {label}
      </DisclosureToggle>

      {children}

      <Unfold open={open} appear={false}>
        <FadingScroll className="max-h-[min(18rem,50dvh)]">
          <ol className="flex flex-col gap-px pt-1">
            {steps.map((step, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the position of a step identifies it, because new steps go only at the end
              <InboxStep key={at} step={step} live={live} />
            ))}
          </ol>
        </FadingScroll>
      </Unfold>
    </div>
  );
}
