import { useState } from 'react';
import { InviteForm } from '@/components/features/members/InviteForm';
import { InviteOutcomes } from '@/components/features/members/InviteOutcomes';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useInviteToWorkspace } from '@/hooks/api/useInviteToWorkspace';
import type { InviteToWorkspaceRequestDto } from '@/lib/api';
import type { InviteOutcome } from '@/lib/members';
import type { Team } from '@/lib/team';

const NO_TEAMS: readonly string[] = [];

type InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string | undefined;
  teams: readonly Team[];
  teamIds?: readonly string[];
};

export function InviteDialog({
  open,
  onOpenChange,
  slug,
  teams,
  teamIds = NO_TEAMS,
}: InviteDialogProps) {
  const invite = useInviteToWorkspace(slug);
  const [sent, setSent] = useState<InviteOutcome[] | null>(null);
  const [round, setRound] = useState(0);
  const sending = invite.isPending;

  const send = (terms: InviteToWorkspaceRequestDto) => {
    if (slug && !sending) {
      invite.mutate(terms, { onSuccess: setSent });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || !sending) {
          onOpenChange(next);
        }
      }}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setSent(null);
          setRound((was) => was + 1);
          invite.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!sending}>
        {sent ? (
          <InviteOutcomes outcomes={sent} />
        ) : (
          <InviteForm
            key={round}
            teams={teams}
            teamIds={teamIds}
            sending={sending}
            failure={invite.isError ? invite.error.message : null}
            onSend={send}
            onEdit={() => invite.isError && invite.reset()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
