import type { QueryClient } from '@tanstack/react-query';
import { gitHubKeys } from '@/hooks/api/useGitHub';
import { lineKeys } from '@/hooks/api/useLines';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type { LineResponseDto, WorkspaceListingResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { SLUG } from '@/stories/fixtures/runners';

export { SLUG };

export const TEAM_ID = 'team_platform';

export const INSTALLATION_ID = '42';

const LISTING: WorkspaceListingResponseDto[] = [
  { id: 'workspace_acme', name: 'Acme', slug: SLUG, role: 'owner' },
  { id: 'workspace_side', name: 'Side project', slug: 'side', role: 'member' },
];

const LINES: LineResponseDto[] = [
  {
    id: 'line_delivery',
    key: 'delivery',
    name: 'Delivery',
    stations: [],
    reactions: [],
    repositories: [],
    source: null,
    replayCheck: null,
  },
];

export const seedWorkspaces = (client: QueryClient) =>
  client.setQueryData(workspaceKeys.all, LISTING);

export const emptyWorkspaces = (client: QueryClient) =>
  client.setQueryData(workspaceKeys.all, []);

export const failWorkspaces = (client: QueryClient) =>
  failQuery(client, workspaceKeys.all);

export const seedLines = (client: QueryClient) =>
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);

export const emptyLines = (client: QueryClient) =>
  client.setQueryData(lineKeys.forTeam(TEAM_ID), []);

export const failLines = (client: QueryClient) =>
  failQuery(client, lineKeys.forTeam(TEAM_ID));

export const failConnection = (client: QueryClient) =>
  failQuery(client, gitHubKeys.connection(SLUG, INSTALLATION_ID));
