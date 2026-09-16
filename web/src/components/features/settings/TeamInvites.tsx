import { PendingInvite } from '@/components/features/settings/PendingInvite';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { useInvites } from '@/hooks/api/useInvites';
import { failed } from '@/lib/query';

type TeamInvitesProps = {
  teamId: string | undefined;
};

export function TeamInvites({ teamId }: TeamInvitesProps) {
  const invites = useInvites(teamId);

  if (failed(invites)) {
    return (
      <SettingsSection title="Invited">
        <CouldNotLoad
          what="Invitations"
          retrying={invites.isFetching}
          onRetry={() => void invites.refetch()}
          className="items-start px-4 py-3"
        />
      </SettingsSection>
    );
  }

  if (!invites.data || invites.data.length === 0) {
    return null;
  }

  return (
    <SettingsSection title="Invited" count={invites.data.length}>
      {invites.data.map((invite) => (
        <PendingInvite key={invite.id} invite={invite} teamId={teamId} />
      ))}
    </SettingsSection>
  );
}
