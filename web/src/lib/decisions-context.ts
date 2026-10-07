import { createContext, useContext } from 'react';
import type { TaskDecisions } from '@/lib/decision';

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
  readonly reasoningAt: string | null;
  readonly disputing: Disputing;
}

export const DecisionsContext = createContext<Deciding | null>(null);

export const useDeciding = (): Deciding | null => useContext(DecisionsContext);
