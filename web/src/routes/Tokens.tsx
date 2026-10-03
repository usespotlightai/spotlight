import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CreateTokenDialog } from '@/components/features/tokens/CreateTokenDialog';
import { RevokeTokenDialog } from '@/components/features/tokens/RevokeTokenDialog';
import { TokenCreated } from '@/components/features/tokens/TokenCreated';
import { TokenRow } from '@/components/features/tokens/TokenRow';
import { TokenRowSkeleton } from '@/components/features/tokens/TokenRowSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Button } from '@/components/ui/button';
import type { CreatedWorkspaceToken } from '@/hooks/api/useCreateWorkspaceToken';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useWorkspaceTokens } from '@/hooks/api/useWorkspaceTokens';
import { failed, loading } from '@/lib/query';
import { administers } from '@/lib/role';
import type { WorkspaceToken } from '@/lib/token';
import { workspacePath } from '@/lib/workspace';

export function Tokens() {
  const { slug } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const admin = workspace ? administers(workspace.role) : false;
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
        title="Tokens"
        description="A workspace token lets Terraform or a script act in this workspace, within what the token may do. Only owners and admins of the workspace can see, create and revoke them."
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
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-border bg-card px-3 shadow-none"
              onClick={() => setCreating(true)}
              disabled={!workspaceId}
            >
              Create a token
            </Button>
          }
        >
          {loading(tokens) && (
            <div role="status" aria-label="Loading the tokens">
              <TokenRowSkeleton />
            </div>
          )}

          {failed(tokens) && (
            <CouldNotLoad
              what="Tokens"
              retrying={tokens.isFetching}
              onRetry={() => void tokens.refetch()}
              className="items-start px-4 py-3"
            />
          )}

          {tokens.data?.length === 0 && (
            <div className="flex flex-col items-start gap-3 px-4 py-4">
              <p className="text-muted-foreground text-sm">
                No tokens yet. Create one to let Terraform manage this
                workspace.
              </p>

              <Button
                size="sm"
                className="rounded-full"
                onClick={() => setCreating(true)}
              >
                Create the first token
              </Button>
            </div>
          )}

          {tokens.data?.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onRevoke={() => setRevoking(token)}
            />
          ))}
        </SettingsSection>
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
