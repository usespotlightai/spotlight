import type { QueryClient } from '@tanstack/react-query';
import { lineKeys } from '@/hooks/api/useLines';
import { memberKeys } from '@/hooks/api/useMembers';
import { taskRunKeys } from '@/hooks/api/useTaskRuns';
import { taskKeys } from '@/hooks/api/useTasks';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  LineResponseDto,
  MemberResponseDto,
  RunStationResponseDto,
  StationResponseDto,
  TaskPersonResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const LINE_ID = 'line_delivery';
export const TASK_ID = 'task_retries';
export const MISSING_TASK_ID = 'task_gone';

const HOUR = 3_600_000;

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * HOUR).toISOString();

const station = (
  key: string,
  name: string,
  color: string,
  position: number,
  kind: StationResponseDto['kind'],
): StationResponseDto => ({
  id: `station_${key}`,
  key,
  name,
  color,
  position,
  description: null,
  harness: 'claude-code',
  model: null,
  effort: null,
  agentPrompt: null,
  kind,
  skills: [],
});

const STATIONS: StationResponseDto[] = [
  station('backlog', 'Backlog', '#a3a8b0', 0, 'backlog'),
  station('triage', 'Triage', '#edc12b', 1, 'work'),
  station('spec', 'Spec', '#b36ae2', 2, 'work'),
  station('implementation', 'Implementation', '#5c66d9', 3, 'work'),
  station('review', 'Code Review', '#56b98d', 4, 'work'),
  station('completed', 'Completed', '#3fa66a', 5, 'completed'),
];

const LINES: LineResponseDto[] = [
  {
    id: LINE_ID,
    key: 'delivery',
    name: 'Delivery',
    stations: STATIONS,
    reactions: [],
    repositories: ['acme/api', 'acme/worker'],
  },
];

const SAM: TaskPersonResponseDto = {
  id: 'user_1',
  name: 'Sam Rivera',
  image: null,
};
const MAYA: TaskPersonResponseDto = {
  id: 'user_2',
  name: 'Maya Chen',
  image: null,
};

const MEMBERS: MemberResponseDto[] = [
  { ...SAM, role: 'owner', mayBeSetTo: [] },
  { ...MAYA, role: 'member', mayBeSetTo: [] },
];

const task = (
  over: Partial<TaskResponseDto> & {
    id: string;
    title: string;
    stationId: string;
  },
): TaskResponseDto => ({
  description: null,
  attachments: [],
  createdAt: hoursAgo(24),
  running: false,
  awaitingReview: null,
  pullRequest: null,
  raisedBy: SAM,
  assignee: null,
  note: null,
  ...over,
});

export const TASKS: TaskResponseDto[] = [
  task({
    id: 'task_checkout',
    title: 'Flaky checkout test on CI',
    stationId: 'station_triage',
    createdAt: hoursAgo(5),
  }),
  task({
    id: 'task_rate_limits',
    title: 'Add rate limiting to the public API',
    stationId: 'station_spec',
    awaitingReview: { conversationId: 'task_rate_limits:0' },
    assignee: SAM,
    createdAt: hoursAgo(50),
  }),
  task({
    id: TASK_ID,
    title: 'Drain the stuck retry queues',
    stationId: 'station_implementation',
    running: true,
    assignee: MAYA,
    createdAt: hoursAgo(30),
    description:
      'Webhook deliveries have been failing since the queue worker was redeployed on Friday.\n\n- Find the retry queues holding jobs that never ran\n- Replay what can still be delivered\n- Stop retrying endpoints that answer `410 Gone`',
  }),
  task({
    id: 'task_billing',
    title: 'Reconcile open invoices after the retry drain',
    stationId: 'station_implementation',
    createdAt: hoursAgo(28),
  }),
  task({
    id: 'task_postgres',
    title: 'Upgrade the Postgres driver',
    stationId: 'station_review',
    awaitingReview: { conversationId: 'task_postgres:0' },
    assignee: MAYA,
    createdAt: hoursAgo(96),
  }),
  task({
    id: 'task_tokens',
    title: 'Document runner token rotation',
    stationId: 'station_backlog',
    createdAt: hoursAgo(200),
  }),
  task({
    id: 'task_search',
    title: 'Speed up workspace search',
    stationId: 'station_completed',
    pullRequest: 'https://github.com/acme/api/pull/412',
    createdAt: hoursAgo(400),
  }),
];

const at = (key: string): RunStationResponseDto => {
  const found = STATIONS.find((each) => each.key === key) ?? STATIONS[0];

  return {
    name: found?.name ?? '',
    color: found?.color ?? '',
    position: found?.position ?? 0,
    count: STATIONS.length,
  };
};

const RUNS: TaskRunResponseDto[] = [
  {
    id: 'run_retries_3',
    state: 'claimed',
    attempt: 1,
    exitCode: null,
    startedAt: hoursAgo(0.2),
    updatedAt: hoursAgo(0.1),
    harness: 'claude-code',
    station: at('implementation'),
    review: null,
  },
  {
    id: 'run_retries_2',
    state: 'completed',
    attempt: 1,
    exitCode: 0,
    startedAt: hoursAgo(4),
    updatedAt: hoursAgo(3.7),
    harness: 'claude-code',
    station: at('spec'),
    review: { state: 'settled', conversationId: `${TASK_ID}:0` },
  },
  {
    id: 'run_retries_1',
    state: 'completed',
    attempt: 1,
    exitCode: 0,
    startedAt: hoursAgo(6),
    updatedAt: hoursAgo(5.9),
    harness: 'claude-code',
    station: at('triage'),
    review: null,
  },
];

const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  role: 'owner',
  teams: [{ id: TEAM_ID, name: 'Platform' }],
};

export const seedWorkspace = (client: QueryClient) =>
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);

export const seedBoard = (client: QueryClient) => {
  seedWorkspace(client);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(taskKeys.forTeam(TEAM_ID), TASKS);
  client.setQueryData(memberKeys.forTeam(TEAM_ID), MEMBERS);
  client.setQueryData(taskRunKeys.forTask(TASK_ID), RUNS);
};

export const emptyBoard = (client: QueryClient) => {
  seedWorkspace(client);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(taskKeys.forTeam(TEAM_ID), []);
  client.setQueryData(memberKeys.forTeam(TEAM_ID), MEMBERS);
};

export const failBoard = (client: QueryClient) => {
  seedWorkspace(client);
  failQuery(client, lineKeys.forTeam(TEAM_ID));
};

export const failTask = (client: QueryClient) => {
  seedWorkspace(client);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  failQuery(client, taskKeys.forTeam(TEAM_ID));
};
