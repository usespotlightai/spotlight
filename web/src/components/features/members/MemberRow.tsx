import { useState } from 'react';
import { useNavigate } from 'react-router';

import { MemberActions } from '@/components/features/members/MemberActions';
import { MemberConfirmDialog } from '@/components/features/members/MemberConfirmDialog';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { useChangeMemberRole } from '@/hooks/api/useChangeMemberRole';
import { useLeaveWorkspace } from '@/hooks/api/useLeaveWorkspace';
import { useSuspendMember } from '@/hooks/api/useSuspendMember';
import { useUnsuspendMember } from '@/hooks/api/useUnsuspendMember';
import {
  describeTeams,
  type MemberChange,
  type WorkspaceMember,
} from '@/lib/members';
import { nameOfRole } from '@/lib/role';
import { cn } from '@/lib/utils';

type MemberRowProps = {
  slug: string;
  member: WorkspaceMember;
};

export function MemberRow({ slug, member }: MemberRowProps) {
  const navigate = useNavigate();
  const changeRole = useChangeMemberRole(slug);
  const suspend = useSuspendMember(slug);
  const unsuspend = useUnsuspendMember(slug);
  const leave = useLeaveWorkspace(slug);
  const [asking, setAsking] = useState<MemberChange | null>(null);
  const suspended = member.suspendedAt !== null;
  const confirming = { suspend, unsuspend, leave }[asking ?? 'suspend'];

  const confirm = () => {
    const done = { onSuccess: () => setAsking(null) };

    if (asking === 'suspend') {
      suspend.mutate(member.id, done);
    } else if (asking === 'unsuspend') {
      unsuspend.mutate(member.id, done);
    } else if (asking === 'leave') {
      leave.mutate(undefined, { onSuccess: () => void navigate('/') });
    }
  };

  return (
    <li data-slot="member-row" className={cn(suspended && 'opacity-60')}>
      <SettingsRow
        label={member.name}
        leading={
          <PersonAvatar person={member} className="data-[size=sm]:size-8" />
        }
        description={
          <span className="flex flex-wrap gap-x-1">
            <span className="flex min-w-0 max-w-full">
              <span title={member.email} className="min-w-0 truncate">
                {member.email}
              </span>
              <span aria-hidden className="shrink-0 whitespace-pre">
                {' ·'}
              </span>
            </span>
            <span>{describeTeams(member.teams)}</span>
          </span>
        }
      >
        <span className="flex items-center gap-2">
          {suspended && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              Suspended
            </span>
          )}
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
            assignableRoles={member.assignableRoles}
            mayBeSuspended={member.mayBeSuspended}
            mayBeUnsuspended={member.mayBeUnsuspended}
            mayLeave={member.mayLeave}
            disabled={changeRole.isPending}
            onChangeRole={(role) =>
              changeRole.mutate({ userId: member.id, role })
            }
            onAsk={(change) => {
              confirming.reset();
              setAsking(change);
            }}
          />
        </span>
      </SettingsRow>

      <MemberConfirmDialog
        change={asking}
        name={member.name}
        pending={confirming.isPending || confirming.isSuccess}
        error={confirming.isError ? confirming.error.message : null}
        onConfirm={confirm}
        onClose={() => setAsking(null)}
      />
    </li>
  );
}
