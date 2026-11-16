import { useParams } from 'react-router';

import { InferenceSettingsPage } from '@/components/features/settings/InferenceSettingsPage';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { isAdmin } from '@/lib/role';

export function WorkspaceInference() {
  const { slug } = useParams();
  const { data: workspace } = useWorkspace(slug);

  if (!slug) {
    return null;
  }

  return (
    <InferenceSettingsPage
      workspaceId={workspace?.id}
      checks={workspace ? isAdmin(workspace.role) : false}
    />
  );
}
