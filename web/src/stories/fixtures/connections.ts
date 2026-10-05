import type { QueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import { connectionKeys } from '@/hooks/api/useConnections';
import type {
  ConfiguredIntegrationResponseDto,
  HostConnectionsResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { CONFIGURATION, TEAM_ID } from '@/stories/fixtures/team';

const PERSONAL: ConfiguredIntegrationResponseDto[] = [
  {
    source: 'linear',
    name: 'Linear',
    path: 'integrations/linear',
    standing: 'linked',
    holding: 'requester',
    handle: 'Acme',
    described: null,
  },
  {
    source: 'sentry',
    name: 'Sentry',
    path: 'integrations/sentry',
    standing: 'unlinked',
    holding: 'requester',
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
];

const CONNECTIONS: HostConnectionsResponseDto = {
  mine: [
    {
      source: 'linear',
      handle: '@sam',
      connectedAt: '2026-10-01T09:00:00.000Z',
      tools: [
        { tool: 'linear.comment', rule: 'allowed' },
        { tool: 'linear.issue-create', rule: 'allowed' },
      ],
    },
  ],
  people: [
    {
      source: 'linear',
      personId: 'user_1',
      name: 'Sam Rivera',
      handle: '@sam',
      connectedAt: '2026-10-01T09:00:00.000Z',
    },
    {
      source: 'linear',
      personId: 'user_2',
      name: 'Maya Chen',
      handle: '@maya',
      connectedAt: '2026-10-02T14:30:00.000Z',
    },
    {
      source: 'sentry',
      personId: 'user_2',
      name: 'Maya Chen',
      handle: 'maya@acme.dev',
      connectedAt: '2026-10-03T08:15:00.000Z',
    },
  ],
};

export const seedTeamConnections = (client: QueryClient) => {
  client.setQueryData(configurationKeys.forTeam(TEAM_ID), {
    integrations: PERSONAL,
  });
  client.setQueryData(connectionKeys.forTeam(TEAM_ID), CONNECTIONS);
};

export const seedTeamConnectionsWithRules = (client: QueryClient) => {
  seedTeamConnections(client);
  client.setQueryData(connectionKeys.forTeam(TEAM_ID), {
    ...CONNECTIONS,
    mine: CONNECTIONS.mine.map((each) => ({
      ...each,
      tools: [
        { tool: 'linear.comment', rule: 'needs-approval' },
        { tool: 'linear.issue-create', rule: 'blocked' },
        { tool: 'linear.issue', rule: 'allowed' },
      ],
    })),
  });
};

export const emptyTeamConnections = (client: QueryClient) => {
  client.setQueryData(configurationKeys.forTeam(TEAM_ID), CONFIGURATION);
  client.setQueryData(connectionKeys.forTeam(TEAM_ID), {
    mine: [],
    people: [],
  });
};

export const failTeamConnections = (client: QueryClient) => {
  failQuery(client, configurationKeys.forTeam(TEAM_ID));
  failQuery(client, connectionKeys.forTeam(TEAM_ID));
};
