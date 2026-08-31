import { MessageSquareDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useResolveInboxItem } from '@/hooks/api/useResolveInboxItem';

type InboxResolveProps = {
  slug: string;
  itemId: string;
};

/** Answering carries the work on; this says there is nothing left to carry. */
export function InboxResolve({ slug, itemId }: InboxResolveProps) {
  const resolve = useResolveInboxItem();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Resolve"
      title="Resolve"
      className="rounded-full bg-card text-muted-foreground shadow-xs"
      disabled={resolve.isPending}
      onClick={() => resolve.mutate({ slug, itemId })}
    >
      <MessageSquareDot className="size-3.5" aria-hidden />
    </Button>
  );
}
