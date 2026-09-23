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
    path: '.spotlight/integrations/linear.yml',
    standing: 'listens',
    handle: null,
  },
  {
    source: 'slack',
    name: 'Slack',
    path: '.spotlight/integrations/slack.yml',
    standing: 'linked',
    handle: 'Acme',
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
