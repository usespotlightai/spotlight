import type {
  ConnectionToolRuleResponseDto,
  HarnessResponseDto,
  IntegrationViewResponseDto,
  MyConnectionResponseDto,
  PersonConnectionResponseDto,
  RunnerPoolResourceResponseDto,
  TeamSkillResponseDto,
  WorkspaceTokenResourceResponseDto,
} from '@/lib/api';
import { daysAgo, hoursAgo } from '@/mocks/clock';
import { GROWTH_ID, PLATFORM_ID, perWorld, WORKSPACE } from '@/mocks/world';
import { MAYA, PRIYA, SAM, TOM } from '@/mocks/world/people';
import {
  FLEET,
  type Fleet,
  NO_FLEET,
  RUNNER_POOLS,
} from '@/mocks/world/settings-runners';

export const WORKSPACE_ID = WORKSPACE.id;

export const SIGNED_IN = SAM;

export const INSTALL_URL =
  'https://github.com/apps/spotlight/installations/new';

const daysFromNow = (days: number) => daysAgo(-days);

export const HARNESSES: HarnessResponseDto[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [
      { id: 'opus', name: 'Opus' },
      { id: 'sonnet', name: 'Sonnet' },
      { id: 'haiku', name: 'Haiku' },
    ],
    defaultModel: 'sonnet',
    efforts: ['low', 'medium', 'high'],
  },
  {
    id: 'codex',
    name: 'Codex',
    models: [{ id: 'gpt-5', name: 'GPT-5' }],
    defaultModel: 'gpt-5',
    efforts: ['low', 'medium', 'high'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    models: [],
    defaultModel: '',
    efforts: [],
  },
];

export const REPOSITORIES = [
  'acme/api',
  'acme/worker',
  'acme/web',
  'acme/infra',
  'acme/docs',
  'acme/mobile',
];

const integration = (
  source: string,
  name: string,
  over: Partial<IntegrationViewResponseDto> = {},
): IntegrationViewResponseDto => ({
  source,
  name,
  path: `integrations/${source}`,
  standing: 'linked',
  holding: 'team',
  handle: null,
  described: null,
  ...over,
});

const LINEAR = integration('linear', 'Linear', {
  holding: 'requester',
  handle: '@acme-bot',
});

const SENTRY = integration('sentry', 'Sentry', {
  holding: 'requester',
  handle: 'acme',
});

const SLACK = integration('slack', 'Slack', { handle: 'Acme' });

const INTEGRATIONS: Record<string, IntegrationViewResponseDto[]> = {
  [PLATFORM_ID]: [
    LINEAR,
    SENTRY,
    SLACK,
    integration('grafana', 'Grafana', { handle: 'acme.grafana.net' }),
    integration('pagerduty', 'PagerDuty', { standing: 'listens' }),
    integration('payments-api', 'Payments API', {
      standing: 'listens',
      described: {
        kind: 'openapi',
        tools: 14,
        readAt: hoursAgo(3),
        problem: null,
      },
    }),
    integration('billing', 'Billing API', {
      described: {
        kind: 'graphql',
        tools: 1,
        readAt: hoursAgo(0.2),
        problem: null,
      },
    }),
    integration('honeycomb', 'Honeycomb', {
      handle: 'acme-production',
      described: {
        kind: 'mcp',
        tools: 24,
        readAt: hoursAgo(0.1),
        problem: null,
      },
    }),
    integration('statuspage', 'Statuspage', {
      standing: 'unlinked',
      described: {
        kind: 'mcp',
        tools: 0,
        readAt: hoursAgo(0.1),
        problem: 'could not be read: status.acme.dev answered 401',
      },
    }),
  ],
  [GROWTH_ID]: [
    LINEAR,
    SLACK,
    integration('posthog', 'PostHog', { handle: 'acme-growth' }),
  ],
};

const TOOLS_OF: Record<string, string[]> = {
  linear: ['linear.issue', 'linear.comment', 'linear.issue-create'],
  sentry: ['sentry.issue', 'sentry.events'],
};

export const toolRules = (
  source: string,
  rule: ConnectionToolRuleResponseDto['rule'] = 'allowed',
): ConnectionToolRuleResponseDto[] =>
  (TOOLS_OF[source] ?? []).map((tool) => ({ tool, rule }));

export type TeamConnections = {
  mine: MyConnectionResponseDto[];
  people: PersonConnectionResponseDto[];
};

const person = (
  source: string,
  who: typeof SAM,
  handle: string,
  connectedDaysAgo: number,
): PersonConnectionResponseDto => ({
  source,
  personId: who.id,
  name: who.name,
  handle,
  connectedAt: daysAgo(connectedDaysAgo),
});

const CONNECTIONS: Record<string, TeamConnections> = {
  [PLATFORM_ID]: {
    mine: [
      {
        source: 'linear',
        handle: '@sam',
        connectedAt: daysAgo(6),
        tools: [
          { tool: 'linear.issue', rule: 'allowed' },
          { tool: 'linear.comment', rule: 'allowed' },
          { tool: 'linear.issue-create', rule: 'needs-approval' },
        ],
      },
    ],
    people: [
      person('linear', SAM, '@sam', 6),
      person('linear', MAYA, '@maya', 5),
      person('linear', TOM, '@tom', 2),
      person('sentry', MAYA, 'maya@acme.dev', 4),
    ],
  },
  [GROWTH_ID]: {
    mine: [
      {
        source: 'linear',
        handle: '@sam',
        connectedAt: daysAgo(6),
        tools: toolRules('linear'),
      },
    ],
    people: [
      person('linear', SAM, '@sam', 6),
      person('linear', PRIYA, '@priya', 9),
    ],
  },
};

const SKILLS: Record<string, TeamSkillResponseDto[]> = {
  [PLATFORM_ID]: [
    {
      key: 'grafana-dashboards',
      description: 'Reading this team’s dashboards before touching an alert.',
    },
    {
      key: 'our-migrations',
      description:
        'Generating database migrations, never writing them by hand.',
    },
    {
      key: 'release-notes',
      description: 'Writing release notes in the voice the team uses.',
    },
  ],
  [GROWTH_ID]: [
    {
      key: 'experiment-briefs',
      description: 'Writing an experiment brief with a metric and a stop rule.',
    },
  ],
};

export const workspaceToken = (
  name: string,
  over: Partial<WorkspaceTokenResourceResponseDto> = {},
): WorkspaceTokenResourceResponseDto => ({
  id: `token_${name.replace(/-/g, '_')}`,
  version: 1,
  address: name,
  warnings: [],
  workspaceId: WORKSPACE_ID,
  name,
  description: '',
  scopes: ['read'],
  issuedBy: SAM.id,
  issuedAt: daysAgo(0),
  expiresAt: daysFromNow(90),
  ...over,
});

const TOKENS: WorkspaceTokenResourceResponseDto[] = [
  workspaceToken('terraform', {
    description: 'Applies acme/infra from CI on every merge to main',
    scopes: ['configure', 'secrets', 'runners'],
    issuedAt: daysAgo(12),
    expiresAt: daysFromNow(78),
  }),
  workspaceToken('plans', {
    description: 'Plans acme/infra on every pull request',
    scopes: ['plan'],
    issuedAt: daysAgo(2),
    expiresAt: daysFromNow(28),
  }),
  workspaceToken('trust-setup', {
    scopes: ['configure', 'trusts'],
    issuedAt: daysAgo(40),
    expiresAt: null,
  }),
];

export type SettingsWorld = {
  gitHubConnected: boolean;
  integrations: Record<string, IntegrationViewResponseDto[]>;
  connections: Record<string, TeamConnections>;
  skills: Record<string, TeamSkillResponseDto[]>;
  tokens: WorkspaceTokenResourceResponseDto[];
  pools: RunnerPoolResourceResponseDto[];
  fleet: Fleet;
  settingUp: string[];
};

const NOBODY: TeamConnections = { mine: [], people: [] };

export const settingsWorld = perWorld(
  (kind): SettingsWorld =>
    kind === 'empty'
      ? {
          gitHubConnected: false,
          integrations: { [PLATFORM_ID]: [], [GROWTH_ID]: [] },
          connections: {
            [PLATFORM_ID]: structuredClone(NOBODY),
            [GROWTH_ID]: structuredClone(NOBODY),
          },
          skills: { [PLATFORM_ID]: [], [GROWTH_ID]: [] },
          tokens: [],
          pools: [],
          fleet: structuredClone(NO_FLEET),
          settingUp: [],
        }
      : {
          gitHubConnected: true,
          integrations: structuredClone(INTEGRATIONS),
          connections: structuredClone(CONNECTIONS),
          skills: structuredClone(SKILLS),
          tokens: structuredClone(TOKENS),
          pools: structuredClone(RUNNER_POOLS),
          fleet: structuredClone(FLEET),
          settingUp: [],
        },
);
