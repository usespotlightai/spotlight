import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { InviteDialog } from '@/components/features/members/InviteDialog';
import { MembersFilterMenu } from '@/components/features/members/MembersFilterMenu';
import { MembersList } from '@/components/features/members/MembersList';
import { PendingInvites } from '@/components/features/members/PendingInvites';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useWorkspaceInvites } from '@/hooks/api/useWorkspaceInvites';
import { useWorkspaceMembers } from '@/hooks/api/useWorkspaceMembers';
import { showOf, showsInvites } from '@/lib/members';
import { administers } from '@/lib/role';
import { workspacePath } from '@/lib/workspace';

export function WorkspaceMembers() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { data: workspace } = useWorkspace(slug);
  const admin = workspace ? administers(workspace.role) : false;
  const members = useWorkspaceMembers(admin ? slug : undefined);
  const invites = useWorkspaceInvites(admin ? slug : undefined);
  const [inviting, setInviting] = useState(false);
  const show = showOf(params);

  if (!slug) {
    return null;
  }

  if (workspace && !admin) {
    return <Navigate to={workspacePath(slug)} replace />;
  }

  const actions = (
    <span className="flex items-center gap-2">
      <MembersFilterMenu />
      <Button
        variant="outline"
        size="sm"
        className="rounded-full border-border bg-card px-3 shadow-none"
        onClick={() => setInviting(true)}
        disabled={!admin}
      >
        Invite people
      </Button>
    </span>
  );

  return (
    <>
      <SettingsPage
        title="Members"
        description="Everyone in this workspace, their role and their teams. Only owners and admins can invite people and change roles."
      >
        {show !== 'invited' && (
          <MembersList
            slug={slug}
            members={members}
            show={show}
            action={actions}
          />
        )}

        {showsInvites(show) && (
          <PendingInvites
            slug={slug}
            invites={invites}
            alone={show === 'invited'}
            action={show === 'invited' ? actions : undefined}
          />
        )}
      </SettingsPage>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        slug={slug}
        teams={workspace?.teams ?? []}
      />
    </>
  );
}
