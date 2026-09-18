import { ReviewComposer } from '@/components/features/review/ReviewComposer';
import { ReviewerAvatar } from '@/components/features/review/ReviewerAvatar';
import { Unfold } from '@/components/shared/Unfold';
import { useDraftReviewComment } from '@/hooks/api/useDraftReviewComment';
import { linesOf, type ReviewSpot } from '@/lib/review';
import { useReviewing } from '@/lib/review-context';

type NewReviewCommentProps = {
  spot: ReviewSpot;
  open: boolean;
};

export function NewReviewComment({ spot, open }: NewReviewCommentProps) {
  const reviewing = useReviewing();
  const draft = useDraftReviewComment();

  if (!reviewing) {
    return null;
  }

  return (
    <Unfold
      open={open}
      appear={reviewing.composerAppears}
      className="px-3 py-2 font-sans"
    >
      <div className="max-w-lg">
        <ReviewComposer
          label={`Comment on ${linesOf(spot)}`}
          submitLabel="Add to review"
          avatar={<ReviewerAvatar />}
          pending={draft.isPending}
          failed={draft.isError}
          onCancel={() => reviewing.compose(null)}
          onSubmit={(body) =>
            draft.mutate(
              {
                teamId: reviewing.teamId,
                runId: reviewing.runId,
                body,
                on: spot,
              },
              { onSuccess: () => reviewing.compose(null) },
            )
          }
        />
      </div>
    </Unfold>
  );
}
