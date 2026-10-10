import { Send, Undo2 } from 'lucide-react';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { RowActions } from '@/components/shared/RowActions';
import { useResendInvite } from '@/hooks/api/useResendInvite';
import { useRevokeInvite } from '@/hooks/api/useRevokeInvite';
import type { WorkspaceInvite } from '@/lib/members';

type InviteActionsProps = {
  slug: string;
  invite: WorkspaceInvite;
};

const alertOf = (resendFailed: boolean, revokeFailed: boolean) => {
  if (revokeFailed) {
    return 'Sorry, the invite couldn’t be revoked.';
  }
  if (resendFailed) {
    return 'Sorry, the invite couldn’t be sent again.';
  }

  return null;
};

export function InviteActions({ slug, invite }: InviteActionsProps) {
  const resend = useResendInvite(slug);
  const revoke = useRevokeInvite(slug);

  return (
    <ActionWithAlert alert={alertOf(resend.isError, revoke.isError)}>
      {resend.isSuccess && (
        <span role="status" className="text-muted-foreground text-xs">
          Sent again
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
