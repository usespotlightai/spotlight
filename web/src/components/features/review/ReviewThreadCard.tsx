import { useState } from 'react';
import { ReplyBox } from '@/components/features/review/ReplyBox';
import { ReviewCommentItem } from '@/components/features/review/ReviewCommentItem';
import { Collapsible } from '@/components/shared/Collapsible';
import { useDraftReviewComment } from '@/hooks/api/useDraftReviewComment';
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
    <Collapsible open={!gone} appear={appear} className="px-3 py-2">
      <section
        aria-label={`Comments on ${linesOf(thread.root)}`}
        onPointerEnter={() => onPointedAt?.(true)}
        onPointerLeave={() => onPointedAt?.(false)}
        className="flex flex-col gap-3 rounded-lg border-[0.5px] border-border bg-card p-3 font-sans shadow-xs"
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
          <ReplyBox
            label="Reply"
            open={replying}
            onOpenChange={setReplying}
            pending={draft.isPending}
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
      </section>
    </Collapsible>
  );
}
