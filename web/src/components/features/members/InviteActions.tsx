import { Send, Undo2 } from 'lucide-react';

import { RowActions } from '@/components/shared/RowActions';
import { useResendInvite } from '@/hooks/api/useResendInvite';
import { useRevokeInvite } from '@/hooks/api/useRevokeInvite';
import { useResetAfter } from '@/hooks/useResetAfter';
import type { WorkspaceInvite } from '@/lib/members';

const RESENT_SHOWN_MS = 4000;

type InviteActionsProps = {
  slug: string;
  invite: WorkspaceInvite;
};

export function InviteActions({ slug, invite }: InviteActionsProps) {
  const resend = useResendInvite(slug);
  const revoke = useRevokeInvite(slug);
  const { isSuccess: resent, reset: resetResent } = resend;

  useResetAfter(resent, resetResent, RESENT_SHOWN_MS);

  return (
    <>
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
    </>
  );
}
