import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { type CodeReview, type ReviewSpot, threadsOf } from '@/lib/review';
import { ReviewContext } from '@/lib/review-context';

type ReviewProviderProps = {
  teamId: string;
  runId: string;
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
  review,
  children,
}: ReviewProviderProps) {
  const [composer, setComposer] = useState<Composer>(CLOSED);
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
      review,
      threads,
      composing: composer.spot,
      composerAppears: composer.appears,
      compose,
    }),
    [teamId, runId, review, threads, composer, compose],
  );

  return <ReviewContext value={reviewing}>{children}</ReviewContext>;
}
