import { Archive, ArchiveX } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useReopenInboxEntry } from '@/hooks/api/useReopenInboxEntry';
import { useResolveInboxEntry } from '@/hooks/api/useResolveInboxEntry';
import { type InboxEntry, reopenable, resolvable } from '@/lib/inbox';

type ResolveToggleProps = {
  slug: string;
  entry: InboxEntry;
};

export function ResolveToggle({ slug, entry }: ResolveToggleProps) {
  const resolve = useResolveInboxEntry();
  const reopen = useReopenInboxEntry();

  if (!resolvable(entry) && !reopenable(entry)) {
    return null;
  }

  const resolving = resolvable(entry);
  const label = resolving ? 'Resolve' : 'Unresolve';
  const Icon = resolving ? Archive : ArchiveX;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" />}
        aria-label={label}
        disabled={resolve.isPending || reopen.isPending}
        onClick={() =>
          resolving
            ? resolve.mutate({ slug, entry })
            : reopen.mutate({ slug, entry })
        }
        className="-my-0.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-[color,opacity] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 group-hover/row:opacity-100 group-has-[a:focus-visible]/row:opacity-100"
      >
        <Icon aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
