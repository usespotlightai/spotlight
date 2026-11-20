import { type ReactNode, useMemo, useRef, useState } from 'react';

import { COLLAPSE_MS } from '@/components/shared/Collapsible';
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
  const settling = useRef<ReturnType<typeof setTimeout>>(undefined);

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
        clearTimeout(settling.current);
        settling.current = setTimeout(
          () =>
            document
              .getElementById(anchor)
              ?.scrollIntoView({ block: 'center' }),
          COLLAPSE_MS,
        );
      },
    }),
    [focused, places, runId],
  );

  return <StepAnchorsContext value={value}>{children}</StepAnchorsContext>;
}
