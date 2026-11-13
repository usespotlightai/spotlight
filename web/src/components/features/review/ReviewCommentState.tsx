import { ExternalLink } from 'lucide-react';

import type { PullRequestRoute, ReviewComment } from '@/lib/review';
import { cn } from '@/lib/utils';

const STATE_DESCRIPTION: Record<ReviewComment['state'], string> = {
  draft: 'Draft',
  sending: 'Sending to GitHub',
  posted: 'On GitHub',
  failed: 'Not posted to GitHub',
};

const SENDING_DESCRIPTION: Record<PullRequestRoute, string> = {
  routed: STATE_DESCRIPTION.sending,
  waiting: 'Posts when the pull request opens',
  ambiguous: 'Names no repository',
};

const AMBIGUOUS =
  'The task has more than one pull request. The comment names no repository.';

export function ReviewCommentState({
  comment,
  route,
}: {
  comment: ReviewComment;
  route: PullRequestRoute;
}) {
  const sending = comment.state === 'sending';
  const description = sending
    ? SENDING_DESCRIPTION[route]
    : STATE_DESCRIPTION[comment.state];
  const title =
    comment.failure ?? (sending && route === 'ambiguous' ? AMBIGUOUS : null);

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
          'relative gap-1 outline-none pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70',
        )}
      >
        {description}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    );
  }

  return (
    <span className={className} title={title ?? undefined}>
      {description}
    </span>
  );
}
