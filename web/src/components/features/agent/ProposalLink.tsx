import { ChevronRight } from 'lucide-react';
import type { Proposal } from '@/lib/chat';
import { cn } from '@/lib/utils';

const standing = (proposal: Proposal): string =>
  proposal.state === 'created'
    ? 'Task created'
    : proposal.state === 'accepted'
      ? 'Creating task'
      : proposal.state === 'dismissed'
        ? 'Dismissed'
        : 'Open';

type ProposalLinkProps = {
  proposal: Proposal;
  active: boolean;
  onOpen: () => void;
};

export function ProposalLink({ proposal, active, onOpen }: ProposalLinkProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      className={cn(
        '-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
        active && 'bg-accent',
        proposal.state === 'dismissed' && 'opacity-60',
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">Proposed task: </span>
        <span className="font-medium text-foreground">{proposal.title}</span>
      </span>
      <span className="shrink-0 text-muted-foreground text-xs">
        {standing(proposal)}
      </span>
      <ChevronRight
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </button>
  );
}
