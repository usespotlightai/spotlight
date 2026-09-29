import type { QueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { teamTraceKeys } from '@/hooks/api/useTeamTraces';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  ChatSummaryResponseDto,
  HarnessResponseDto,
  LineResponseDto,
  RunStationResponseDto,
  TeamRunResponseDto,
  TeamTraceResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { RANGES, windowOf } from '@/lib/range';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';

const MINUTE = 60_000;

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * MINUTE).toISOString();

const HOUR = 60;
const DAY = 24 * HOUR;

const STATIONS = {
  triage: { name: 'Triage', color: '#edc12b', position: 0, count: 4 },
  spec: { name: 'Spec', color: '#b36ae2', position: 1, count: 4 },
  implementation: {
    name: 'Implementation',
    color: '#5c66d9',
    position: 2,
    count: 4,
  },
  review: { name: 'Code Review', color: '#56b98d', position: 3, count: 4 },
} satisfies Record<string, RunStationResponseDto>;

const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  role: 'owner',
  teams: [{ id: TEAM_ID, name: 'Platform' }],
};

const LINES: LineResponseDto[] = [
  {
    id: 'line_delivery',
    key: 'delivery',
    name: 'Delivery',
    stations: [],
    reactions: [],
    repositories: ['acme/api', 'acme/worker'],
  },
];

const HARNESSES: HarnessResponseDto[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [{ id: 'claude-opus-5', name: 'Opus 5' }],
    defaultModel: 'claude-opus-5',
    efforts: ['low', 'medium', 'high'],
  },
];

const chat = (
  over: Partial<ChatSummaryResponseDto> & { id: string; title: string },
): ChatSummaryResponseDto => ({
  harness: 'claude-code',
  model: null,
  effort: null,
  repositories: [],
  createdAt: minutesAgo(3 * DAY),
  updatedAt: minutesAgo(3 * DAY),
  working: false,
  ...over,
});

const CHATS: ChatSummaryResponseDto[] = [
  chat({
    id: 'chat_rate_limits',
    title: 'Rate limiting for the public API',
    updatedAt: minutesAgo(0),
    working: true,
  }),
  chat({
    id: 'chat_onboarding',
    title: 'Shorten the onboarding checklist',
    harness: 'cursor',
    updatedAt: minutesAgo(42),
  }),
  chat({
    id: 'chat_billing',
    title: 'Split billing out of the monolith',
    updatedAt: minutesAgo(5 * HOUR),
  }),
  chat({
    id: 'chat_q4',
    title: 'What should the platform team take on next quarter?',
    updatedAt: minutesAgo(4 * DAY),
  }),
];

const run = (
  over: Partial<TeamRunResponseDto> & {
    id: string;
    taskTitle: string;
    startedAt: string;
  },
): TeamRunResponseDto => ({
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  updatedAt: over.startedAt,
  harness: 'claude-code',
  image: null,
  station: STATIONS.implementation,
  review: null,
  taskId: `task_${over.id}`,
  taskDescription: null,
  ...over,
});

const RUNS: TeamRunResponseDto[] = [
  run({
    id: 'run_retries_2',
    taskTitle: 'Drain the stuck retry queues',
    startedAt: minutesAgo(3),
    state: 'claimed',
    exitCode: null,
  }),
  run({
    id: 'run_rate_limits',
    taskTitle: 'Add rate limiting to the public API',
    station: STATIONS.spec,
    startedAt: minutesAgo(8),
    state: 'queued',
    exitCode: null,
  }),
  run({
    id: 'run_billing',
    taskTitle: 'Split the billing webhooks by tenant',
    station: STATIONS.spec,
    startedAt: minutesAgo(20),
    state: 'waiting',
    exitCode: null,
    review: { state: 'owed', conversationId: 'task_billing:0' },
  }),
  run({
    id: 'run_tokens',
    taskTitle: 'Document runner token rotation',
    station: STATIONS.spec,
    startedAt: minutesAgo(40),
    state: 'parked',
    exitCode: null,
    review: { state: 'owed', conversationId: 'task_tokens:0' },
  }),
  run({
    id: 'run_retries_1',
    taskTitle: 'Drain the stuck retry queues',
    startedAt: minutesAgo(50),
    review: { state: 'owed', conversationId: 'task_retries:0' },
  }),
  run({
    id: 'run_postgres',
    taskTitle: 'Upgrade the Postgres driver',
    station: STATIONS.review,
    startedAt: minutesAgo(DAY + 2 * HOUR),
    review: { state: 'settled', conversationId: 'task_postgres:0' },
  }),
  run({
    id: 'run_checkout',
    taskTitle: 'Flaky checkout test on CI',
    station: STATIONS.triage,
    startedAt: minutesAgo(DAY + 5 * HOUR),
    state: 'failed',
    exitCode: 1,
  }),
  run({
    id: 'run_webhooks',
    taskTitle: 'Rename the billing webhooks',
    station: STATIONS.review,
    startedAt: minutesAgo(3 * DAY),
  }),
];

const trace = (
  over: Partial<TeamTraceResponseDto> & {
    taskId: string;
    title: string;
    startedAt: string;
  },
): TeamTraceResponseDto => ({
  station: STATIONS.implementation,
  stations: [STATIONS.triage, STATIONS.spec, STATIONS.implementation],
  harness: 'claude-code',
  state: 'completed',
  runs: 3,
  input: null,
  output: null,
  ms: 312_000,
  steps: 48,
  faults: 0,
  cost: 1.84,
  currency: 'USD',
  ...over,
});

const TRACES: TeamTraceResponseDto[] = [
  trace({
    taskId: 'task_retries',
    title: 'Drain the stuck retry queues',
    startedAt: minutesAgo(3),
    state: 'claimed',
    input: 'Start with webhook-retries and leave billing alone.',
    output: null,
    ms: null,
    cost: null,
  }),
  trace({
    taskId: 'task_rate_limits',
    title: 'Add rate limiting to the public API',
    startedAt: minutesAgo(5 * HOUR),
    stations: [STATIONS.triage, STATIONS.spec],
    station: STATIONS.spec,
    input: 'Limit per API key, with a burst allowance.',
    output: 'Wrote the spec and asked which limits apply.',
    ms: 96_000,
    cost: 0.42,
  }),
  trace({
    taskId: 'task_postgres',
    title: 'Upgrade the Postgres driver',
    startedAt: minutesAgo(DAY + 2 * HOUR),
    stations: Object.values(STATIONS),
    station: STATIONS.review,
    input: 'Upgrade pg to 9 and check timestamp round-trips.',
    output: 'Opened a pull request with the migration.',
    faults: 2,
    ms: 1_064_000,
    cost: 4.1,
  }),
  trace({
    taskId: 'task_checkout',
    title: 'Flaky checkout test on CI',
    startedAt: minutesAgo(2 * DAY),
    stations: [STATIONS.triage],
    station: STATIONS.triage,
    state: 'failed',
    input: 'It fails one run in twelve.',
    faults: 1,
    ms: 41_000,
    cost: 0.0068,
  }),
  trace({
    taskId: 'task_webhooks',
    title: 'Rename the billing webhooks',
    startedAt: minutesAgo(6 * DAY),
    stations: Object.values(STATIONS),
    station: STATIONS.review,
    input: 'Rename all six billing events.',
    output: 'Renamed them and kept the old names as aliases.',
  }),
  trace({
    taskId: 'task_tokens',
    title: 'Document runner token rotation',
    startedAt: minutesAgo(12 * DAY),
    stations: [STATIONS.triage, STATIONS.spec],
    station: STATIONS.spec,
    input: 'Cover self-hosted runners too.',
    output: 'Drafted the guide.',
    ms: 188_000,
    cost: 0.96,
  }),
];

export const seedTeam = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), [
    { fullName: 'acme/api' },
    { fullName: 'acme/worker' },
  ]);
};

export const seedChats = (client: QueryClient) => {
  seedTeam(client);
  client.setQueryData(chatKeys.forTeam(TEAM_ID), CHATS);
};

export const emptyChats = (client: QueryClient) => {
  seedTeam(client);
  client.setQueryData(chatKeys.forTeam(TEAM_ID), []);
};

export const failChats = (client: QueryClient) => {
  seedTeam(client);
  failQuery(client, chatKeys.forTeam(TEAM_ID));
};

export const seedRuns = (client: QueryClient) => {
  seedTeam(client);
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), RUNS);
};

export const emptyRuns = (client: QueryClient) => {
  seedTeam(client);
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), []);
};

export const failRuns = (client: QueryClient) => {
  seedTeam(client);
  failQuery(client, teamRunKeys.forTeam(TEAM_ID));
};

const within = (range: string) => {
  const { from } = windowOf(range);

  return TRACES.filter((each) => Date.parse(each.startedAt) >= from);
};

export const seedTraces = (client: QueryClient) => {
  seedTeam(client);

  for (const range of RANGES) {
    client.setQueryData(
      teamTraceKeys.forTeam(TEAM_ID, range.id),
      within(range.id),
    );
  }
};

export const emptyTraces = (client: QueryClient) => {
  seedTeam(client);

  for (const range of RANGES) {
    client.setQueryData(teamTraceKeys.forTeam(TEAM_ID, range.id), []);
  }
};

export const failTraces = (client: QueryClient) => {
  seedTeam(client);

  for (const range of RANGES) {
    failQuery(client, teamTraceKeys.forTeam(TEAM_ID, range.id));
  }
};
