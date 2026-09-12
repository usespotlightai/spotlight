import { useState } from 'react';
import { InviteMemberDialog } from '@/components/features/settings/InviteMemberDialog';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamMemberRow } from '@/components/features/settings/TeamMemberRow';
import { Button } from '@/components/ui/button';
import { useChangeMemberRole } from '@/hooks/api/useChangeMemberRole';
import { useMembers } from '@/hooks/api/useMembers';
import { messageOf } from '@/lib/error';

type TeamMembersProps = {
  slug: string | undefined;
  teamId: string | undefined;
};

export function TeamMembers({ slug, teamId }: TeamMembersProps) {
  const { data: members } = useMembers(teamId);
  const changeRole = useChangeMemberRole(slug, teamId);
  const [inviting, setInviting] = useState(false);

  const on = members ?? [];

  return (
    <>
      <SettingsSection
        title="Members"
        count={members?.length}
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
        {on.length > 0 ? (
          on.map((member) => (
            <TeamMemberRow
              key={member.id}
              member={member}
              onOffer={member.mayBeSetTo}
              onChange={(role) =>
                changeRole.mutate({ userId: member.id, role })
              }
              pending={
                changeRole.isPending &&
                changeRole.variables?.userId === member.id
              }
            />
          ))
        ) : (
          <p className="px-4 py-4 text-muted-foreground text-sm">
            No one is on this team yet.
          </p>
        )}
      </SettingsSection>

      {changeRole.isError && (
        <p role="alert" className="-mt-4 text-destructive text-xs">
          {messageOf(changeRole.error)}
        </p>
      )}

      <InviteMemberDialog
        open={inviting}
        onOpenChange={setInviting}
        teamId={teamId}
      />
    </>
  );
}
