import { useState } from 'react';
import { InviteMemberDialog } from '@/components/features/settings/InviteMemberDialog';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamMemberRow } from '@/components/features/settings/TeamMemberRow';
import { TeamMemberRowSkeleton } from '@/components/features/settings/TeamMemberRowSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Button } from '@/components/ui/button';
import { useChangeMemberRole } from '@/hooks/api/useChangeMemberRole';
import { useMembers } from '@/hooks/api/useMembers';
import { failed, loading } from '@/lib/query';

type TeamMembersProps = {
  slug: string | undefined;
  teamId: string | undefined;
};

export function TeamMembers({ slug, teamId }: TeamMembersProps) {
  const members = useMembers(teamId);
  const changeRole = useChangeMemberRole(slug, teamId);
  const [inviting, setInviting] = useState(false);

  const on = members.data ?? [];

  return (
    <>
      <SettingsSection
        title="Members"
        count={members.data?.length}
        action={
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-border bg-card px-3 shadow-none"
            onClick={() => setInviting(true)}
            disabled={!teamId}
          >
            Add a member
          </Button>
        }
      >
        {loading(members) && (
          <div role="status" aria-label="Loading the members">
            <TeamMemberRowSkeleton />
          </div>
        )}

        {failed(members) && (
          <CouldNotLoad
            what="Members"
            retrying={members.isFetching}
            onRetry={() => void members.refetch()}
            className="items-start px-4 py-3"
          />
        )}

        {members.data?.length === 0 && (
          <p className="px-4 py-4 text-muted-foreground text-sm">
            No members yet. Add one to get started.
          </p>
        )}

        {on.map((member) => (
          <TeamMemberRow
            key={member.id}
            member={member}
            onOffer={member.mayBeSetTo}
            onChange={(role) => changeRole.mutate({ userId: member.id, role })}
            pending={
              changeRole.isPending && changeRole.variables?.userId === member.id
            }
          />
        ))}
      </SettingsSection>

      <InviteMemberDialog
        open={inviting}
        onOpenChange={setInviting}
        teamId={teamId}
      />
    </>
  );
}
