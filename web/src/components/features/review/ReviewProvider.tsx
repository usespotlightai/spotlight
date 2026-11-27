import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { nonEmpty } from '@/lib/non-empty';
import {
  type CodeReview,
  type ReviewSpot,
  reviewOfStack,
  threadsOf,
} from '@/lib/review';
import { ReviewContext, StackTeamContext } from '@/lib/review-context';

type ReviewProviderProps = {
  teamId: string;
  taskId: string | null | undefined;
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
  taskId,
  repository,
  alone,
  review: ofRun,
  children,
}: ReviewProviderProps): ReactElement {
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
    () =>
      nonEmpty(taskId)
        ? {
            teamId,
            taskId,
            repository,
            review,
            threads,
            composing: composer.spot,
            composerAppears: composer.appears,
            compose,
          }
        : null,
    [teamId, taskId, repository, review, threads, composer, compose],
  );

  return (
    <StackTeamContext value={teamId}>
      <ReviewContext value={reviewing}>{children}</ReviewContext>
    </StackTeamContext>
  );
}
