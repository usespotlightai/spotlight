import { createContext, useContext } from 'react';
import type { CodeReview, ReviewSpot, ReviewThread } from '@/lib/review';

export interface Reviewing {
  readonly teamId: string;
  readonly runId: string;
  readonly review: CodeReview | undefined;
  readonly threads: readonly ReviewThread[];
  readonly composing: ReviewSpot | null;
  readonly composerAppears: boolean;
  compose(spot: ReviewSpot | null): void;
}

export const ReviewContext = createContext<Reviewing | null>(null);

export const useReviewing = (): Reviewing | null => useContext(ReviewContext);
