import { PendingInvite } from '@/components/features/settings/PendingInvite';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { useInvites } from '@/hooks/api/useInvites';

type TeamInvitesProps = {
  teamId: string | undefined;
};

export function TeamInvites({ teamId }: TeamInvitesProps) {
  const { data: invites } = useInvites(teamId);

  if (!invites || invites.length === 0) {
    return null;
  }

  return (
    <SettingsSection title="Invited" count={invites.length}>
      {invites.map((invite) => (
        <PendingInvite key={invite.id} invite={invite} teamId={teamId} />
      ))}
    </SettingsSection>
  );
}
