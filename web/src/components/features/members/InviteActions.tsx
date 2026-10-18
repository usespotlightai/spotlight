import { Send, Undo2 } from 'lucide-react';
import { useEffect } from 'react';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { RowActions } from '@/components/shared/RowActions';
import { useResendInvite } from '@/hooks/api/useResendInvite';
import { useRevokeInvite } from '@/hooks/api/useRevokeInvite';
import { messageOf } from '@/lib/error';
import type { WorkspaceInvite } from '@/lib/members';

const RESENT_SHOWN_MS = 4000;

const alertOf = (
  resendFailure: Error | null,
  revokeFailure: Error | null,
): string | null => {
  if (revokeFailure) {
    return messageOf(revokeFailure, 'Sorry, the invite couldn’t be revoked.');
  }
  if (resendFailure) {
    return messageOf(resendFailure, 'Sorry, the invite couldn’t be resent.');
  }

  return null;
};

type InviteActionsProps = {
  slug: string;
  invite: WorkspaceInvite;
};

export function InviteActions({ slug, invite }: InviteActionsProps) {
  const resend = useResendInvite(slug);
  const revoke = useRevokeInvite(slug);
  const { isSuccess: resent, reset: resetResent } = resend;

  useEffect(() => {
    if (!resent) {
      return;
    }

    const timer = setTimeout(resetResent, RESENT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [resent, resetResent]);

  return (
    <ActionWithAlert alert={alertOf(resend.error, revoke.error)}>
      {resent && (
        <span role="status" className="text-muted-foreground text-xs">
          Resent
        </span>
      )}
      <RowActions
        label={`Actions for ${invite.email}`}
        disabled={resend.isPending || revoke.isPending}
        actions={[
          {
            label: 'Resend invite',
            icon: Send,
            onSelect: () => {
              revoke.reset();
              resend.mutate(invite.id);
            },
          },
          {
            label: 'Revoke invite',
            icon: Undo2,
            onSelect: () => {
              resend.reset();
              revoke.mutate(invite.id);
            },
          },
        ]}
      />
    </ActionWithAlert>
  );
}
