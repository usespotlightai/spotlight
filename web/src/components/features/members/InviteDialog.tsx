import { useState } from 'react';
import { InviteForm } from '@/components/features/members/InviteForm';
import { InviteOutcomes } from '@/components/features/members/InviteOutcomes';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  const [sent, setSent] = useState<InviteOutcome[] | null>(null);
  const [round, setRound] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => {
        if (!settled) {
          setSent(null);
          setRound((was) => was + 1);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <InviteOutcomes outcomes={sent} />
        ) : (
          <InviteForm
            key={round}
            slug={slug}
            teams={teams}
            teamIds={teamIds}
            onSent={setSent}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
