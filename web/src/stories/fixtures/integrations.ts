import type { QueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import type { ConfiguredIntegrationResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { failGitHub, seedGitHub } from '@/stories/fixtures/github';
import { CONFIGURATION, TEAM_ID } from '@/stories/fixtures/team';

const CONFIGURED: ConfiguredIntegrationResponseDto[] = [
  {
    source: 'linear',
    name: 'Linear',
    path: 'integrations/linear',
    standing: 'listens',
    holding: 'team',
    handle: null,
    described: null,
  },
  {
    source: 'slack',
    name: 'Slack',
    path: 'integrations/slack',
    standing: 'linked',
    holding: 'team',
    handle: 'Acme',
    described: null,
  },
  {
    source: 'petstore',
    name: 'Petstore',
    path: 'integrations/petstore',
    standing: 'listens',
    holding: 'team',
    handle: null,
    described: {
      kind: 'openapi',
      tools: 19,
      readAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      problem: null,
    },
  },
  {
    source: 'billing',
    name: 'Billing',
    path: 'integrations/billing',
    standing: 'listens',
    holding: 'team',
    handle: null,
    described: {
      kind: 'openapi',
      tools: 0,
      readAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      problem: 'could not be read: billing.example answered 404',
    },
  },
];

export const seedTeamIntegrations = (client: QueryClient) => {
  seedGitHub(true)(client);
  client.setQueryData(configurationKeys.forTeam(TEAM_ID), {
    integrations: CONFIGURED,
  });
};

export const emptyTeamIntegrations = (client: QueryClient) => {
  seedGitHub(true)(client);
  client.setQueryData(configurationKeys.forTeam(TEAM_ID), CONFIGURATION);
};

export const failTeamIntegrations = (client: QueryClient) => {
  failGitHub(client);
  failQuery(client, configurationKeys.forTeam(TEAM_ID));
};
