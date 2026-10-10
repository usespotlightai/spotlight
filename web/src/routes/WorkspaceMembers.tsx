import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { InviteDialog } from '@/components/features/members/InviteDialog';
import { MembersFilterMenu } from '@/components/features/members/MembersFilterMenu';
import { MembersList } from '@/components/features/members/MembersList';
import { PendingInvites } from '@/components/features/members/PendingInvites';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SectionButton } from '@/components/shared/SectionButton';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useWorkspaceInvites } from '@/hooks/api/useWorkspaceInvites';
import { useWorkspaceMembers } from '@/hooks/api/useWorkspaceMembers';
import { showOf, showsInvites } from '@/lib/members';
import { failed } from '@/lib/query';
import { administers } from '@/lib/role';
import { workspacePath } from '@/lib/workspace';

const TITLE = 'Members';

const DESCRIPTION = 'Everyone in this workspace, their role and their teams.';

export function WorkspaceMembers() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const found = useWorkspace(slug);
  const workspace = found.data;
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

  if (failed(found)) {
    return (
      <SettingsPage title={TITLE} description={DESCRIPTION}>
        <SettingsSection>
          <CouldNotLoad
            what="The workspace’s members"
            retrying={found.isFetching}
            onRetry={() => void found.refetch()}
            className="items-start px-4 py-3"
          />
        </SettingsSection>
      </SettingsPage>
    );
  }

  const actions = (
    <span className="flex items-center gap-2">
      <MembersFilterMenu />
      <SectionButton onClick={() => setInviting(true)} disabled={!admin}>
        Invite people
      </SectionButton>
    </span>
  );

  return (
    <>
      <SettingsPage title={TITLE} description={DESCRIPTION}>
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
