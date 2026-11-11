import type { WorkspaceResponseDto } from '@/lib/api';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';

export const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  avatarUrl: null,
  teams: [{ id: TEAM_ID, name: 'Platform', avatarUrl: null }],
  role: 'owner',
  setupStatus: 'done',
};
