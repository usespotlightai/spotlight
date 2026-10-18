import { ExternalLink } from 'lucide-react';
import type { ReviewComment } from '@/lib/review';
import { cn } from '@/lib/utils';

const STATE_DESCRIPTION: Record<ReviewComment['state'], string> = {
  draft: 'Draft',
  sending: 'Sending to GitHub',
  posted: 'On GitHub',
  failed: 'Not posted to GitHub',
};

export function ReviewCommentState({
  comment,
  waiting,
}: {
  comment: ReviewComment;
  waiting: boolean;
}) {
  const description =
    comment.state === 'sending' && waiting
      ? 'Posts when the pull request opens'
      : STATE_DESCRIPTION[comment.state];

  const className = cn(
    'flex shrink-0 items-center rounded-full border border-border bg-card px-1.5 py-0 font-medium text-muted-foreground text-xs',
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
          'gap-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70',
        )}
      >
        {description}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    );
  }

  return (
    <span className={className} title={comment.failure ?? undefined}>
      {description}
    </span>
  );
}
