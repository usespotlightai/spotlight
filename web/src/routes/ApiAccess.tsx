import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { OidcTrustsSection } from '@/components/features/oidc-trusts/OidcTrustsSection';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CreateTokenDialog } from '@/components/features/tokens/CreateTokenDialog';
import { RevokeTokenDialog } from '@/components/features/tokens/RevokeTokenDialog';
import { TokenCreated } from '@/components/features/tokens/TokenCreated';
import { TokenRow } from '@/components/features/tokens/TokenRow';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SectionButton } from '@/components/shared/SectionButton';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import type { CreatedWorkspaceToken } from '@/hooks/api/useCreateWorkspaceToken';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useWorkspaceTokens } from '@/hooks/api/useWorkspaceTokens';
import { failed, loading } from '@/lib/query';
import { isAdmin } from '@/lib/role';
import type { WorkspaceToken } from '@/lib/token';
import { workspacePath } from '@/lib/workspace';

export function ApiAccess() {
  const { slug } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const admin = workspace ? isAdmin(workspace.role) : false;
  const workspaceId = admin ? workspace?.id : undefined;
  const tokens = useWorkspaceTokens(workspaceId);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedWorkspaceToken | null>(null);
  const [revoking, setRevoking] = useState<WorkspaceToken | null>(null);

  if (!slug) {
    return null;
  }

  if (workspace && !admin) {
    return <Navigate to={workspacePath(slug)} replace />;
  }

  return (
    <>
      <SettingsPage
        title="API access"
        description="Workspace token: a key that lets Terraform or a script act in this workspace. OIDC trust: a rule that lets a CI job get a short-lived workspace token without a stored key. Only owners and admins can see them."
      >
        {created && (
          <TokenCreated
            key={created.token}
            name={created.name}
            token={created.token}
            onDone={() => setCreated(null)}
          />
        )}

        <SettingsSection
          title="Workspace tokens"
          count={tokens.data?.length}
          action={
            <SectionButton
              onClick={() => setCreating(true)}
              disabled={!workspaceId}
            >
              Create a token
            </SectionButton>
          }
        >
          {loading(tokens) && (
            <div role="status" aria-label="Loading the tokens">
              <IconRowSkeleton nameWidth="w-20" aboutWidth="w-64" />
            </div>
          )}

          {failed(tokens) && (
            <CouldNotLoad
              what="Tokens"
              retrying={tokens.isFetching}
              onRetry={() => void tokens.refetch()}
              className="px-4 py-6 text-center"
            />
          )}

          {tokens.data?.length === 0 && (
            <p className="px-4 py-4 text-muted-foreground text-sm">
              No tokens yet. Create one for Terraform or a script.
            </p>
          )}

          {tokens.data?.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onRevoke={() => setRevoking(token)}
            />
          ))}
        </SettingsSection>

        <OidcTrustsSection slug={admin ? slug : undefined} />
      </SettingsPage>

      <CreateTokenDialog
        open={creating}
        onOpenChange={setCreating}
        workspaceId={workspaceId}
        onCreated={setCreated}
      />

      <RevokeTokenDialog
        workspaceId={workspaceId}
        token={revoking}
        onClose={() => setRevoking(null)}
      />
    </>
  );
}
