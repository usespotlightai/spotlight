import { createContext, useContext } from 'react';

import type { Decision, TaskDecisions } from '@/lib/decision';

export type Disputing = {
  pending: boolean;
  dispute: (
    decisionId: string,
    path: string,
    reason: string,
  ) => Promise<unknown>;
};

export interface Deciding {
  readonly found: TaskDecisions;
  /** Where the run that recorded the decision shows its reasoning. */
  readonly reasoningAt: (decision: Decision) => string;
  readonly disputing: Disputing;
}

export const DecisionsContext = createContext<Deciding | null>(null);

export const useDeciding = (): Deciding | null => useContext(DecisionsContext);
