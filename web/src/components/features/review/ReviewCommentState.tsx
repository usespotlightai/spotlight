import { ExternalLink } from 'lucide-react';
import type { ReviewComment } from '@/lib/review';
import { cn } from '@/lib/utils';

const TOLD: Record<ReviewComment['state'], string> = {
  draft: 'Draft',
  sending: 'Sending to GitHub',
  posted: 'On GitHub',
  failed: 'Not on GitHub',
};

export function ReviewCommentState({
  comment,
  waiting,
}: {
  comment: ReviewComment;
  waiting: boolean;
}) {
  const told =
    comment.state === 'sending' && waiting
      ? 'Posts when the pull request opens'
      : TOLD[comment.state];

  const className = cn(
    'shrink-0 rounded-full border-[0.5px] px-1.5 py-px text-[10px] leading-4',
    comment.state === 'draft' &&
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    comment.state === 'sending' && 'border-border text-muted-foreground',
    comment.state === 'posted' && 'border-border text-muted-foreground',
    comment.state === 'failed' &&
      'border-destructive/40 bg-destructive/10 text-destructive',
  );

  if (comment.state === 'posted' && comment.url) {
    return (
      <a
        href={comment.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          className,
          'flex items-center gap-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70',
        )}
      >
        {told}
        <ExternalLink className="size-2.5" aria-hidden />
      </a>
    );
  }

  return (
    <span className={className} title={comment.failure ?? undefined}>
      {told}
    </span>
  );
}
