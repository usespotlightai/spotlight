import { Send, Undo2 } from 'lucide-react';
import { useRevokeInvite } from '@/hooks/api/useRevokeInvite';
import type { InviteResponseDto } from '@/lib/api';

type PendingInviteProps = {
  invite: InviteResponseDto;
  teamId: string | undefined;
};

export function PendingInvite({ invite, teamId }: PendingInviteProps) {
  const revoke = useRevokeInvite(teamId);

  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      <button
        type="button"
        onClick={() => revoke.mutate(invite.id)}
        disabled={revoke.isPending}
        aria-label={`Unsend the invitation to ${invite.email}`}
        title="Unsend"
        className="group flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Send
          className="size-3 group-hover:hidden group-focus-visible:hidden"
          aria-hidden
        />
        <Undo2
          className="hidden size-3 group-hover:block group-focus-visible:block"
          aria-hidden
        />
      </button>

      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {invite.email}
      </span>

      <span className="shrink-0 text-muted-foreground text-sm">
        Invited by {invite.invitedBy}
      </span>
    </div>
  );
}
