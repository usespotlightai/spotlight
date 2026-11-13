import { API_PREFIX } from '@platform/http/routes';

export const workspaceAvatarUrl = (slug: string, digest: string): string =>
  `/${API_PREFIX}/workspaces/${encodeURIComponent(slug)}/avatar/${digest}`;

export const teamAvatarUrl = (teamId: string, digest: string): string =>
  `/${API_PREFIX}/teams/${encodeURIComponent(teamId)}/avatar/${digest}`;
