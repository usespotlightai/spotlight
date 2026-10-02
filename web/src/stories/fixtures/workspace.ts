import type { QueryClient } from '@tanstack/react-query';
import { lineKeys } from '@/hooks/api/useLines';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type { LineResponseDto, WorkspaceResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { seedInbox, TEAM_ID } from '@/stories/fixtures/inbox';
import { SLUG, seedRunners } from '@/stories/fixtures/runners';

export { SLUG };

const GROWTH_ID = 'team_growth';

const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  role: 'owner',
  teams: [
    { id: TEAM_ID, name: 'Platform' },
    { id: GROWTH_ID, name: 'Growth' },
  ],
};

const line = (id: string, name: string): LineResponseDto => ({
  id,
  key: id,
  name,
  stations: [],
  reactions: [],
  repositories: [],
  source: null,
  replayCheck: null,
});

const seedFrame = (client: QueryClient) => {
  seedRunners(client);
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
};

export const seedWorkspace = (client: QueryClient) => {
  seedInbox(client);
  seedFrame(client);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), [
    line('line_delivery', 'Delivery'),
    line('line_incidents', 'Incidents'),
  ]);
  client.setQueryData(lineKeys.forTeam(GROWTH_ID), [
    line('line_experiments', 'Experiments'),
  ]);
};

export const missingWorkspace = (client: QueryClient) =>
  client.setQueryData(workspaceKeys.detail(SLUG), null);

export const failWorkspace = (client: QueryClient) =>
  failQuery(client, workspaceKeys.detail(SLUG));
