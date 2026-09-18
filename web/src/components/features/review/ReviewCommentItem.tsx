import { useState } from 'react';
import { ReviewCommentState } from '@/components/features/review/ReviewCommentState';
import { ReviewComposer } from '@/components/features/review/ReviewComposer';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { Unfold } from '@/components/shared/Unfold';
import { useDeleteReviewComment } from '@/hooks/api/useDeleteReviewComment';
import { useEditReviewComment } from '@/hooks/api/useEditReviewComment';
import { type ReviewComment, whoWrote } from '@/lib/review';
import { useReviewing } from '@/lib/review-context';
import { since } from '@/lib/runner';

const ACTION =
  'rounded text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70';

type ReviewCommentItemProps = {
  comment: ReviewComment;
  first: boolean;
  onLeaving?: (leaving: boolean) => void;
};

export function ReviewCommentItem({
  comment,
  first,
  onLeaving,
}: ReviewCommentItemProps) {
  const reviewing = useReviewing();
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const edit = useEditReviewComment();
  const remove = useDeleteReviewComment();

  if (!reviewing) {
    return null;
  }

  const at = {
    teamId: reviewing.teamId,
    runId: reviewing.runId,
    commentId: comment.id,
  };

  const leave = (going: boolean) => {
    setLeaving(going);
    onLeaving?.(going);
  };

  return (
    <li>
      <Unfold
        open={!leaving}
        appear={false}
        className={first ? undefined : 'pt-3'}
      >
        <div className="flex gap-2.5">
          <div className="flex h-5 shrink-0 items-center">
            <PersonAvatar
              person={{ name: comment.authorName, image: comment.authorImage }}
              className="size-5"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex h-5 items-center gap-2 text-xs">
              <span className="font-medium text-foreground">
                {whoWrote(comment)}
              </span>
              <span className="text-faint">
                {since(comment.createdAt)}
                {comment.editedAt && ' · edited'}
              </span>
              <ReviewCommentState
                comment={comment}
                waiting={!reviewing.review?.pullRequest}
              />
            </div>

            {editing ? (
              <ReviewComposer
                label="Edit the comment"
                submitLabel="Save"
                initial={comment.body}
                pending={edit.isPending}
                failed={edit.isError}
                onCancel={() => setEditing(false)}
                onSubmit={(body) =>
                  edit.mutate(
                    { ...at, body },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              />
            ) : (
              <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
                {comment.body}
              </p>
            )}

            {comment.yours && !editing && (
              <div className="flex gap-3">
                <button
                  type="button"
                  className={ACTION}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={ACTION}
                  disabled={remove.isPending}
                  onClick={() => {
                    leave(true);
                    remove.mutate(at, { onError: () => leave(false) });
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </Unfold>
    </li>
  );
}
