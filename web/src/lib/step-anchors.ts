import { createContext, useContext } from 'react';
import type { JournalStep } from '@/lib/inbox';

export interface StepAnchors {
  readonly focused: string | null;
  anchorOf(step: JournalStep): string | null;
  has(index: number): boolean;
  focus(index: number): void;
}

const NONE: StepAnchors = {
  focused: null,
  anchorOf: () => null,
  has: () => false,
  focus: () => {},
};

export const stepAnchor = (runId: string, index: number): string =>
  `step-${runId}-${index}`;

export const StepAnchorsContext = createContext<StepAnchors>(NONE);

export const useStepAnchors = (): StepAnchors => useContext(StepAnchorsContext);
