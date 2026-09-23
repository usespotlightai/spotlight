import type { QueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import type {
  ConfiguredIntegrationResponseDto,
  KnownIntegrationResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { CONFIGURATION, ONBOARDING, TEAM_ID } from '@/stories/fixtures/team';

const known = (
  source: string,
  name: string,
  summary: string,
): KnownIntegrationResponseDto => ({
  source,
  name,
  summary,
  deliverTo: `/api/webhooks/w/acme/t/platform/${source}`,
});

const KNOWN: KnownIntegrationResponseDto[] = [
  known('linear', 'Linear', 'Move a task on when its issue is done.'),
  known('slack', 'Slack', 'Ask and answer questions in a thread.'),
  known('sentry', 'Sentry', 'Open a task when a new issue is raised.'),
  known('grafana', 'Grafana', 'Open a task when an alert fires.'),
  known('pagerduty', 'PagerDuty', 'Open a task when an incident is paged.'),
];

const CONFIGURED: ConfiguredIntegrationResponseDto[] = [
  {
    source: 'linear',
    name: 'Linear',
    path: '.spotlight/integrations/linear.yml',
    connectable: false,
    connection: null,
  },
  {
    source: 'slack',
    name: 'Slack',
    path: '.spotlight/integrations/slack.yml',
    connectable: true,
    connection: { handle: null },
  },
];

export const seedTeamIntegrations = (client: QueryClient) => {
  client.setQueryData(onboardingKeys.forTeam(TEAM_ID), {
    ...ONBOARDING,
    integrations: KNOWN,
  });
  client.setQueryData(configurationKeys.forTeam(TEAM_ID), {
    ...CONFIGURATION,
    integrations: CONFIGURED,
  });
};

export const emptyTeamIntegrations = (client: QueryClient) => {
  client.setQueryData(onboardingKeys.forTeam(TEAM_ID), ONBOARDING);
  client.setQueryData(configurationKeys.forTeam(TEAM_ID), CONFIGURATION);
};

export const failTeamIntegrations = (client: QueryClient) => {
  failQuery(client, onboardingKeys.forTeam(TEAM_ID));
  failQuery(client, configurationKeys.forTeam(TEAM_ID));
};
