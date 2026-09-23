import { ReplyBox } from '@/components/features/review/ReplyBox';
import { ReviewCommentItem } from '@/components/features/review/ReviewCommentItem';
import { ThreadEntry } from '@/components/features/review/ThreadEntry';
import { Logo } from '@/components/shared/icons';
import { useDraftReviewComment } from '@/hooks/api/useDraftReviewComment';
import { fileCommentsOf } from '@/lib/review';
import { useReviewing } from '@/lib/review-context';

type FileThreadProps = {
  path: string;
  note: string | null;
  replying: boolean;
  onReplying: (replying: boolean) => void;
};

export function FileThread({
  path,
  note,
  replying,
  onReplying,
}: FileThreadProps) {
  const reviewing = useReviewing();
  const draft = useDraftReviewComment();
  const comments = fileCommentsOf(reviewing?.review?.comments ?? [], path);

  if (!note && comments.length === 0 && !replying) {
    return null;
  }

  return (
    <div className="border-border border-b-[0.5px] px-3 py-2">
      <section
        aria-label={`Comments on ${path}`}
        className="flex flex-col gap-3 rounded-lg border-[0.5px] border-border bg-card p-3 font-sans shadow-xs"
      >
        {(note || comments.length > 0) && (
          <ol className="flex flex-col">
            {note && (
              <ThreadEntry
                avatar={<Logo className="size-5 rounded" aria-hidden />}
                author="Spotlight"
              >
                <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
                  {note}
                </p>
              </ThreadEntry>
            )}

            {comments.map((comment, place) => (
              <ReviewCommentItem
                key={comment.id}
                comment={comment}
                first={!note && place === 0}
              />
            ))}
          </ol>
        )}

        {reviewing && (
          <ReplyBox
            label={note ? 'Reply to the summary' : `Comment on ${path}`}
            open={replying}
            onOpenChange={onReplying}
            pending={draft.isPending}
            failed={draft.isError}
            onSubmit={(body) =>
              draft.mutate(
                {
                  teamId: reviewing.teamId,
                  runId: reviewing.runId,
                  body,
                  on: { path },
                },
                { onSuccess: () => onReplying(false) },
              )
            }
          />
        )}
      </section>
    </div>
  );
}
