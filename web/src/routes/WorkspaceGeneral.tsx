import { useParams } from 'react-router';
import { DownloadTerraformButton } from '@/components/features/settings/DownloadTerraformButton';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed } from '@/lib/query';
import { WORKSPACE_URL_PREFIX } from '@/lib/workspace';

export function WorkspaceGeneral() {
  const { slug } = useParams();
  const workspace = useWorkspace(slug);

  if (!slug) {
    return null;
  }

  return (
    <SettingsPage
      title="General"
      description="What this workspace is called and where it lives."
    >
      {failed(workspace) ? (
        <SettingsSection>
          <CouldNotLoad
            what="The workspace’s settings"
            retrying={workspace.isFetching}
            onRetry={() => void workspace.refetch()}
            className="items-start px-4 py-3"
          />
        </SettingsSection>
      ) : (
        <SettingsSection>
          <SettingsRow label="Workspace name">
            {workspace.data ? (
              <span className="text-foreground text-sm">
                {workspace.data.name}
              </span>
            ) : (
              <span
                role="status"
                aria-label="Loading the workspace name"
                className="flex"
              >
                <SkeletonLine className="w-24 text-sm" />
              </span>
            )}
          </SettingsRow>

          <SettingsRow label="Address">
            <span className="text-muted-foreground text-sm">
              {WORKSPACE_URL_PREFIX}
              {slug}
            </span>
          </SettingsRow>
        </SettingsSection>
      )}

      <SettingsSection title="Terraform">
        <SettingsRow
          label="Download as Terraform"
          description="The workspace’s configuration as a Terraform module, to manage it from code."
        >
          <DownloadTerraformButton
            workspaceId={workspace.data?.id}
            slug={slug}
          />
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  );
}
