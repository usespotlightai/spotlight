import { type ReactNode, useCallback, useMemo, useState } from 'react';

import {
  type CodeReview,
  type ReviewSpot,
  reviewOfStack,
  threadsOf,
} from '@/lib/review';
import { ReviewContext } from '@/lib/review-context';

type ReviewProviderProps = {
  teamId: string;
  runId: string;
  repository: string | null;
  alone: boolean;
  review: CodeReview | undefined;
  children: ReactNode;
};

interface Composer {
  readonly spot: ReviewSpot | null;
  readonly appears: boolean;
}

const CLOSED: Composer = { spot: null, appears: true };

export function ReviewProvider({
  teamId,
  runId,
  repository,
  alone,
  review: ofRun,
  children,
}: ReviewProviderProps) {
  const [composer, setComposer] = useState<Composer>(CLOSED);
  const review = useMemo(
    () => reviewOfStack(ofRun, repository, alone),
    [ofRun, repository, alone],
  );
  const threads = useMemo(() => threadsOf(review?.comments ?? []), [review]);

  const compose = useCallback(
    (spot: ReviewSpot | null) =>
      setComposer((was) => ({ spot, appears: was.spot === null })),
    [],
  );

  const reviewing = useMemo(
    () => ({
      teamId,
      runId,
      repository,
      review,
      threads,
      composing: composer.spot,
      composerAppears: composer.appears,
      compose,
    }),
    [teamId, runId, repository, review, threads, composer, compose],
  );

  return <ReviewContext value={reviewing}>{children}</ReviewContext>;
}
