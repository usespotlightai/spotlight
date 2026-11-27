import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { AvatarSetting } from '@/components/features/settings/AvatarSetting';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useWorkspaceAvatar } from '@/hooks/api/useAvatar';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { nonEmpty } from '@/lib/non-empty';
import { failed } from '@/lib/query';
import { isAdmin } from '@/lib/role';
import { WORKSPACE_URL_PREFIX } from '@/lib/workspace';

export function WorkspaceGeneral(): ReactElement | null {
  const { slug } = useParams();
  const workspace = useWorkspace(slug);
  const change = useWorkspaceAvatar(slug);
  const shown = workspace.data ?? null;

  if (!nonEmpty(slug)) {
    return null;
  }

  return (
    <SettingsPage
      title="General"
      description="Workspace name, avatar and address."
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
            {shown ? (
              <span className="text-foreground text-sm">{shown.name}</span>
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

          {shown ? (
            <AvatarSetting
              name={shown.name}
              avatarUrl={shown.avatarUrl}
              editable={isAdmin(shown.role)}
              change={change}
            />
          ) : (
            <SettingsRow label="Avatar">
              <Skeleton className="size-9 rounded-lg" />
            </SettingsRow>
          )}

          <SettingsRow label="Address" stack>
            <span className="text-foreground text-sm">
              {WORKSPACE_URL_PREFIX}
              {slug}
            </span>
          </SettingsRow>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
