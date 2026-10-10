import { MemberActions } from '@/components/features/members/MemberActions';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { useChangeMemberRole } from '@/hooks/api/useChangeMemberRole';
import { teamsTold, type WorkspaceMember } from '@/lib/members';
import { nameOfRole } from '@/lib/role';

type MemberRowProps = {
  slug: string;
  member: WorkspaceMember;
};

export function MemberRow({ slug, member }: MemberRowProps) {
  const changeRole = useChangeMemberRole(slug);

  return (
    <li data-slot="member-row">
      <SettingsRow
        label={member.name}
        leading={
          <PersonAvatar person={member} className="data-[size=sm]:size-8" />
        }
        description={`${member.email} · ${teamsTold(member.teams)}`}
      >
        <ActionWithAlert
          alert={
            changeRole.isError ? 'Sorry, the role couldn’t be changed.' : null
          }
        >
          <span className="text-muted-foreground text-sm">
            {
              nameOfRole[
                changeRole.isPending ? changeRole.variables.role : member.role
              ]
            }
          </span>
          <MemberActions
            name={member.name}
            role={member.role}
            mayBeSetTo={member.mayBeSetTo}
            disabled={changeRole.isPending}
            onChangeRole={(role) =>
              changeRole.mutate({ userId: member.id, role })
            }
          />
        </ActionWithAlert>
      </SettingsRow>
    </li>
  );
}
