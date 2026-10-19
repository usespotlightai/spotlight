import { GitPullRequestArrow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { VIEW_PULL_REQUEST } from '@/lib/search-words';
import { cn } from '@/lib/utils';

const VIEW_BUTTON = 'rounded-full bg-card shadow-none';

export function ViewPullRequest({ url }: { url: string | null }) {
  if (!url) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={VIEW_BUTTON}
        disabled
      >
        <GitPullRequestArrow aria-hidden />
        {VIEW_PULL_REQUEST}
      </Button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      data-slot="pull-request"
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        VIEW_BUTTON,
      )}
    >
      <GitPullRequestArrow aria-hidden />
      {VIEW_PULL_REQUEST}
    </a>
  );
}
