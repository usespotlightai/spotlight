import { useState } from 'react';
import { ReviewCommentItem } from '@/components/features/review/ReviewCommentItem';
import { ReviewComposer } from '@/components/features/review/ReviewComposer';
import { ReviewerAvatar } from '@/components/features/review/ReviewerAvatar';
import { UNFOLD_MS, Unfold } from '@/components/shared/Unfold';
import { useDraftReviewComment } from '@/hooks/api/useDraftReviewComment';
import { useLingering } from '@/hooks/useLingering';
import { linesOf, type ReviewThread } from '@/lib/review';
import { useReviewing } from '@/lib/review-context';

type ReviewThreadCardProps = {
  thread: ReviewThread;
  appear?: boolean;
  onPointedAt?: (pointing: boolean) => void;
};

export function ReviewThreadCard({
  thread,
  appear = false,
  onPointedAt,
}: ReviewThreadCardProps) {
  const reviewing = useReviewing();
  const [replying, setReplying] = useState(false);
  const draft = useDraftReviewComment();
  const shownComposer = useLingering(replying ? true : null, UNFOLD_MS);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());

  if (!reviewing) {
    return null;
  }

  const answerable = thread.root.state !== 'draft';
  const comments = [thread.root, ...thread.replies];
  const gone = comments.every((comment) => leaving.has(comment.id));

  const leave = (id: string) => (going: boolean) =>
    setLeaving((now) => {
      const next = new Set(now);

      if (going) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });

  return (
    <Unfold open={!gone} appear={appear} className="px-3 py-2">
      <section
        aria-label={`Comments on ${linesOf(thread.root)}`}
        onPointerEnter={() => onPointedAt?.(true)}
        onPointerLeave={() => onPointedAt?.(false)}
        className="flex max-w-lg flex-col gap-3 rounded-lg border-[0.5px] border-border bg-card p-3 font-sans shadow-xs"
      >
        {thread.root.startLine !== null && (
          <p className="-mb-1 text-faint text-xs">On {linesOf(thread.root)}</p>
        )}

        <ol className="flex flex-col">
          {comments.map((comment, place) => (
            <ReviewCommentItem
              key={comment.id}
              comment={comment}
              first={place === 0}
              onLeaving={leave(comment.id)}
            />
          ))}
        </ol>

        {answerable && (
          <div className="flex flex-col">
            <Unfold open={!replying} appear={false}>
              <button
                type="button"
                onClick={() => setReplying(true)}
                className="w-full rounded-md border-[0.5px] border-border bg-card px-2 py-1.5 text-left text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
              >
                Reply…
              </button>
            </Unfold>
            <Unfold open={replying} appear={false}>
              {shownComposer && (
                <ReviewComposer
                  label="Reply"
                  submitLabel="Reply"
                  avatar={<ReviewerAvatar />}
                  pending={draft.isPending}
                  failed={draft.isError}
                  onCancel={() => setReplying(false)}
                  onSubmit={(body) =>
                    draft.mutate(
                      {
                        teamId: reviewing.teamId,
                        runId: reviewing.runId,
                        body,
                        on: { replyTo: thread.root.id },
                      },
                      { onSuccess: () => setReplying(false) },
                    )
                  }
                />
              )}
            </Unfold>
          </div>
        )}
      </section>
    </Unfold>
  );
}
