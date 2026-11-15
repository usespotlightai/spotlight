import { Archive, ArchiveX } from 'lucide-react';

import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useReopenInboxEntry } from '@/hooks/api/useReopenInboxEntry';
import { useResolveInboxEntry } from '@/hooks/api/useResolveInboxEntry';
import { useCommands } from '@/hooks/useCommands';
import { type InboxEntry, reopenable, resolvable } from '@/lib/inbox';

type ResolveToggleProps = {
  slug: string;
  entry: InboxEntry;
};

export function ResolveToggle({ slug, entry }: ResolveToggleProps) {
  const resolve = useResolveInboxEntry();
  const reopen = useReopenInboxEntry();
  const togglable = resolvable(entry) || reopenable(entry);
  const resolving = resolvable(entry);
  const label = resolving ? 'Resolve' : 'Unresolve';
  const Icon = resolving ? Archive : ArchiveX;
  const busy = resolve.isPending || reopen.isPending;
  const toggle = () => {
    if (resolvable(entry)) {
      resolve.mutate({ slug, entry });
    } else if (reopenable(entry)) {
      reopen.mutate({ slug, entry });
    }
  };

  useCommands(
    togglable
      ? [
          {
            id: 'inbox.resolve',
            title: label,
            run: toggle,
            enabled: () => !busy,
          },
        ]
      : [],
  );

  if (!togglable) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the trigger renders this button around its children
        render={<button type="button" />}
        aria-label={label}
        disabled={busy}
        onClick={toggle}
        className="-my-0.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-[color,opacity] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 group-hover/row:opacity-100 group-has-[a:focus-visible]/row:opacity-100 pointer-coarse:size-9 pointer-coarse:opacity-100"
      >
        <Icon aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>
        <ShortcutHint id="inbox.resolve">{label}</ShortcutHint>
      </TooltipContent>
    </Tooltip>
  );
}
