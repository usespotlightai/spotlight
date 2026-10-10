import type { ReactNode } from 'react';
import { InviteRow } from '@/components/features/members/InviteRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import type { useWorkspaceInvites } from '@/hooks/api/useWorkspaceInvites';
import { failed, loading } from '@/lib/query';

type PendingInvitesProps = {
  slug: string;
  invites: ReturnType<typeof useWorkspaceInvites>;
  alone: boolean;
  action?: ReactNode;
};

export function PendingInvites({
  slug,
  invites,
  alone,
  action,
}: PendingInvitesProps) {
  if (!alone && invites.data?.length === 0) {
    return null;
  }

  return (
    <SettingsSection
      title="Pending invites"
      count={invites.data?.length}
      action={action}
      listLabel="Pending invites"
    >
      {loading(invites) && (
        <li role="status" aria-label="Loading the pending invites">
          <IconRowSkeleton nameWidth="w-40" aboutWidth="w-64" />
        </li>
      )}

      {failed(invites) && (
        <li>
          <CouldNotLoad
            what="Pending invites"
            retrying={invites.isFetching}
            onRetry={() => void invites.refetch()}
            className="px-4 py-6 text-center"
          />
        </li>
      )}

      {invites.data?.length === 0 && (
        <li className="px-4 py-4 text-muted-foreground text-sm">
          No pending invites.
        </li>
      )}

      {invites.data?.map((invite) => (
        <InviteRow key={invite.id} slug={slug} invite={invite} />
      ))}
    </SettingsSection>
  );
}
