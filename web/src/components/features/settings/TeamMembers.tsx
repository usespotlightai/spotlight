import { useState } from 'react';
import { InviteDialog } from '@/components/features/members/InviteDialog';
import { AddTeamMember } from '@/components/features/settings/AddTeamMember';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamMemberRow } from '@/components/features/settings/TeamMemberRow';
import { TeamMemberRowSkeleton } from '@/components/features/settings/TeamMemberRowSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { useChangeMemberRole } from '@/hooks/api/useChangeMemberRole';
import { useMembers } from '@/hooks/api/useMembers';
import { failed, loading } from '@/lib/query';
import type { Team } from '@/lib/team';

type TeamMembersProps = {
  slug: string | undefined;
  teamId: string | undefined;
  admin: boolean;
  teams: readonly Team[];
};

export function TeamMembers({ slug, teamId, admin, teams }: TeamMembersProps) {
  const members = useMembers(teamId);
  const changeRole = useChangeMemberRole(slug);
  const [inviting, setInviting] = useState(false);

  const on = members.data ?? [];

  return (
    <>
      <SettingsSection
        title="Members"
        count={members.data?.length}
        action={
          admin && (
            <AddTeamMember
              slug={slug}
              teamId={teamId}
              onInvite={() => setInviting(true)}
            />
          )
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
            {admin
              ? 'No members yet. Add one to get started.'
              : 'No members yet. Please ask an admin to add people.'}
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

      {admin && (
        <InviteDialog
          open={inviting}
          onOpenChange={setInviting}
          slug={slug}
          teams={teams}
          teamIds={teamId ? [teamId] : []}
        />
      )}
    </>
  );
}
