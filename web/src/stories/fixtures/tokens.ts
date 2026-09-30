import type { QueryClient } from '@tanstack/react-query';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { tokenKeys } from '@/hooks/api/useWorkspaceTokens';
import type { WorkspaceResponseDto } from '@/lib/api';
import type { WorkspaceToken } from '@/lib/token';
import { failQuery } from '@/stories/failQuery';
import { SLUG } from '@/stories/fixtures/runners';

export { SLUG };

const WORKSPACE_ID = 'workspace_acme';

const DAY = 24 * 60 * 60 * 1000;

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

const token = (
  name: string,
  over: Partial<WorkspaceToken> = {},
): WorkspaceToken => ({
  id: `token_${name}`,
  version: 0,
  address: name,
  warnings: [],
  workspaceId: WORKSPACE_ID,
  name,
  description: '',
  scopes: ['configure'],
  issuedBy: 'user_sam',
  issuedAt: daysFromNow(-12),
  expiresAt: daysFromNow(78),
  ...over,
});

const TOKENS: WorkspaceToken[] = [
  token('plans', {
    description: 'Plans the platform repository on every pull request',
    scopes: ['plan'],
    issuedAt: daysFromNow(-2),
    expiresAt: daysFromNow(28),
  }),
  token('terraform', {
    description: 'Applies the platform repository from CI',
    scopes: ['configure', 'secrets', 'runners'],
  }),
  token('trust-setup', {
    scopes: ['configure', 'trusts'],
    issuedAt: daysFromNow(-40),
    expiresAt: null,
  }),
];

const seedAs =
  (role: WorkspaceResponseDto['role'], tokens?: WorkspaceToken[]) =>
  (client: QueryClient) => {
    client.setQueryData(workspaceKeys.detail(SLUG), {
      id: WORKSPACE_ID,
      name: 'Acme',
      slug: SLUG,
      role,
      teams: [],
    } satisfies WorkspaceResponseDto);

    if (tokens) {
      client.setQueryData(tokenKeys.forWorkspace(WORKSPACE_ID), tokens);
    }
  };

export const seedTokens = seedAs('owner', TOKENS);

export const emptyTokens = seedAs('owner', []);

export const failTokens = (client: QueryClient) => {
  seedAs('owner')(client);
  failQuery(client, tokenKeys.forWorkspace(WORKSPACE_ID));
};
