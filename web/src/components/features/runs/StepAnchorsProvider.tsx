import { type ReactNode, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (!focused) {
      return;
    }

    const found = requestAnimationFrame(() =>
      document
        .getElementById(focused)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );

    return () => cancelAnimationFrame(found);
  }, [focused]);

  const value = useMemo(
    () => ({
      focused,
      anchorOf: (step: JournalStep) => {
        const index = places.get(step);
        return index === undefined ? null : stepAnchor(runId, index);
      },
      has: (index: number) => index < places.size,
      focus: (index: number) => setFocused(stepAnchor(runId, index)),
    }),
    [focused, places, runId],
  );

  return <StepAnchorsContext value={value}>{children}</StepAnchorsContext>;
}
