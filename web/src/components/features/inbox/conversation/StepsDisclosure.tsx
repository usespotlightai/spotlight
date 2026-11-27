import type { ReactNode } from 'react';

import { InboxStep } from '@/components/features/inbox/conversation/InboxStep';
import { COLLAPSE_MS, Collapsible } from '@/components/shared/Collapsible';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import { FadingScroll } from '@/components/shared/FadingScroll';
import { useMountedFor } from '@/hooks/useMountedFor';
import { useOpenWhenFocused } from '@/hooks/useOpenWhenFocused';
import type { JournalStep } from '@/lib/inbox';
import { useStepAnchors } from '@/lib/step-anchors';

const FIRST_STEPS = 16;

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
      <DisclosureToggle
        open={open}
        onToggle={toggle}
        className="pointer-coarse:min-h-8"
      >
        {label}
      </DisclosureToggle>

      {children}

      <Collapsible open={open} appear={false} lazy>
        <FadingScroll className="max-h-[min(18rem,50dvh)]">
          <StepList steps={steps} live={live} whole={hasFocus} />
        </FadingScroll>
      </Collapsible>
    </div>
  );
}

function StepList({
  steps,
  live,
  whole,
}: {
  steps: readonly JournalStep[];
  live: boolean;
  whole: boolean;
}) {
  const opened = useMountedFor(COLLAPSE_MS);
  const drawn = opened || whole ? steps.length : FIRST_STEPS;

  return (
    <ol className="flex flex-col gap-px pt-1">
      {steps.slice(0, drawn).map((step, at) => (
        // oxlint-disable-next-line react/no-array-index-key -- the position of a step identifies it, because new steps go only at the end
        <InboxStep key={at} step={step} live={live} />
      ))}
    </ol>
  );
}
