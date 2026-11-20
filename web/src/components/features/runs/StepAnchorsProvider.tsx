import { type ReactNode, useMemo, useState } from 'react';

import { COLLAPSE_MS } from '@/components/shared/Collapsible';
import { useTimeout } from '@/hooks/useTimeout';
import type { JournalStep, RunJournal } from '@/lib/inbox';
import { StepAnchorsContext, stepAnchor } from '@/lib/step-anchors';

type StepAnchorsProviderProps = {
  runId: string;
  journals: readonly RunJournal[];
  children: ReactNode;
};

export function StepAnchorsProvider({
  runId,
  journals,
  children,
}: StepAnchorsProviderProps) {
  const [focused, setFocused] = useState<string | null>(null);
  const later = useTimeout();

  const places = useMemo(
    () =>
      new Map(
        journals
          .filter((each) => each.runId === runId)
          .flatMap((each) => each.steps)
          .map((step, index) => [step, index] as const),
      ),
    [journals, runId],
  );

  const value = useMemo(
    () => ({
      focused,
      anchorOf: (step: JournalStep) => {
        const index = places.get(step);
        return index === undefined ? null : stepAnchor(runId, index);
      },
      has: (index: number) => index < places.size,
      focus: (index: number) => {
        const anchor = stepAnchor(runId, index);

        setFocused(anchor);
        later(
          () =>
            document
              .getElementById(anchor)
              ?.scrollIntoView({ block: 'center' }),
          COLLAPSE_MS,
        );
      },
    }),
    [focused, places, runId, later],
  );

  return <StepAnchorsContext value={value}>{children}</StepAnchorsContext>;
}
