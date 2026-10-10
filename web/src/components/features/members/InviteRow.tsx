import { Mail } from 'lucide-react';
import { InviteActions } from '@/components/features/members/InviteActions';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { RowIcon } from '@/components/shared/RowIcon';
import {
  expiryOfInvite,
  inviterNamed,
  teamsTold,
  type WorkspaceInvite,
} from '@/lib/members';
import { nameOfRole } from '@/lib/role';

type InviteRowProps = {
  slug: string;
  invite: WorkspaceInvite;
};

export function InviteRow({ slug, invite }: InviteRowProps) {
  return (
    <li data-slot="invite-row">
      <SettingsRow
        label={invite.email}
        leading={<RowIcon icon={Mail} />}
        description={[
          teamsTold(invite.teams),
          `Invited by ${inviterNamed(invite.invitedBy?.name)}`,
          expiryOfInvite(invite.expiresAt),
        ].join(' · ')}
      >
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {nameOfRole[invite.role]}
          </span>
          <InviteActions slug={slug} invite={invite} />
        </span>
      </SettingsRow>
    </li>
  );
}
