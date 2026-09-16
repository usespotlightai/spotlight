import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { inboxKeys } from '@/hooks/api/useInbox';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import { taskKeys } from '@/hooks/api/useTasks';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  InboxItemResponseDto,
  InboxMessageResponseDto,
  InboxStationResponseDto,
  JournalStepResponseDto,
  LineResponseDto,
  RunJournalResponseDto,
  StationResponseDto,
  TaskResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const OPENED_ITEM_ID = 'task_retries:0';

const STATIONS = {
  triage: { name: 'Triage', color: '#edc12b', position: 0 },
  spec: { name: 'Spec', color: '#b36ae2', position: 1 },
  implementation: { name: 'Implementation', color: '#5c66d9', position: 2 },
  review: { name: 'Code Review', color: '#56b98d', position: 3 },
} satisfies Record<string, InboxStationResponseDto>;

const said = (
  over: Partial<InboxMessageResponseDto> & {
    position: number;
    body: string;
    at: string;
    from?: InboxStationResponseDto;
  },
): InboxMessageResponseDto => {
  const { from = STATIONS.implementation, ...rest } = over;

  return {
    kind: 'asked',
    form: 'words',
    voice: 'station',
    station: from.name,
    stationColor: from.color,
    stationPosition: from.position,
    runId: null,
    attachments: [],
    author: null,
    ...rest,
  };
};

const waiting = (
  over: Partial<InboxItemResponseDto> & {
    taskId: string;
    title: string;
    at: InboxStationResponseDto;
    notes: InboxMessageResponseDto[];
  },
): InboxItemResponseDto => {
  const { at, ...rest } = over;
  const last = rest.notes[rest.notes.length - 1];

  return {
    id: `${rest.taskId}:0`,
    teamId: TEAM_ID,
    description: null,
    attachments: [],
    station: at.name,
    stationColor: at.color,
    stationPosition: at.position,
    stationCount: 4,
    raisedAt: STATIONS.triage,
    standsAt: at,
    createdAt: '2026-09-14T08:12:00.000Z',
    askedAt: last?.at ?? '2026-09-14T08:12:00.000Z',
    resolved: false,
    working: false,
    runId: null,
    unread: false,
    briefing: null,
    ...rest,
  };
};

const step = (
  over: Partial<JournalStepResponseDto> & { text: string },
): JournalStepResponseDto => ({
  kind: 'tool',
  status: 'completed',
  tool: null,
  detail: null,
  ms: 1_200,
  startedAt: '2026-09-15T09:40:00.000Z',
  locations: [],
  given: null,
  returned: null,
  change: null,
  ...over,
});

const INBOX: InboxItemResponseDto[] = [
  waiting({
    taskId: 'task_retries',
    title: 'Drain the stuck retry queues',
    description:
      'Webhook deliveries have been failing since the queue worker was redeployed on Friday.',
    at: STATIONS.implementation,
    createdAt: '2026-09-15T08:05:00.000Z',
    notes: [
      said({
        position: 0,
        runId: 'run_retries_1',
        at: '2026-09-15T09:48:00.000Z',
        body: 'I found two retry queues holding jobs that never ran:\n\n- `webhook-retries` has **1,204** jobs, the oldest from Friday\n- `billing-retries` has **87** jobs, all for invoices that are still open\n\nWhich queue should I drain first?',
      }),
      said({
        position: 1,
        kind: 'answered',
        voice: 'person',
        author: { id: 'user_2', name: 'Maya Chen', image: null },
        at: '2026-09-15T10:02:00.000Z',
        body: 'Start with webhook-retries. Billing is still being reconciled, so leave it alone for now.',
      }),
      said({
        position: 2,
        runId: 'run_retries_2',
        at: '2026-09-15T10:31:00.000Z',
        body: 'Drained `webhook-retries`: 1,201 jobs replayed and 3 failed again with a `410 Gone` from endpoints that no longer exist.\n\nShould I open a pull request that stops retrying after a `410`?',
      }),
    ],
  }),
  waiting({
    taskId: 'task_rate_limits',
    title: 'Add rate limiting to the public API',
    at: STATIONS.spec,
    unread: true,
    notes: [
      said({
        position: 0,
        from: STATIONS.spec,
        at: '2026-09-15T09:20:00.000Z',
        body: 'Should limits apply per API key or per workspace?',
      }),
    ],
  }),
  waiting({
    taskId: 'task_postgres',
    title: 'Upgrade the Postgres driver',
    at: STATIONS.review,
    notes: [
      said({
        position: 0,
        from: STATIONS.review,
        at: '2026-09-14T16:45:00.000Z',
        body: 'The upgrade changes how timestamps round-trip. Is the migration safe to approve?',
      }),
    ],
  }),
  waiting({
    taskId: 'task_checkout',
    title: 'Flaky checkout test on CI',
    at: STATIONS.triage,
    notes: [
      said({
        position: 0,
        from: STATIONS.triage,
        at: '2026-09-14T11:03:00.000Z',
        body: 'It fails one run in twelve. Is this worth fixing before the release?',
      }),
    ],
  }),
  waiting({
    taskId: 'task_webhooks',
    title: 'Rename the billing webhooks',
    at: STATIONS.review,
    resolved: true,
    notes: [
      said({
        position: 0,
        from: STATIONS.review,
        at: '2026-09-12T14:20:00.000Z',
        body: 'Renamed all six events. Can the old names be dropped?',
      }),
    ],
  }),
  waiting({
    taskId: 'task_tokens',
    title: 'Document runner token rotation',
    at: STATIONS.spec,
    resolved: true,
    notes: [
      said({
        position: 0,
        from: STATIONS.spec,
        at: '2026-09-11T10:10:00.000Z',
        body: 'Should the guide cover self-hosted runners too?',
      }),
    ],
  }),
];

const JOURNAL: RunJournalResponseDto[] = [
  {
    runId: 'run_retries_1',
    attempt: 1,
    ms: 142_000,
    spans: [],
    marks: {
      startedAt: '2026-09-15T09:46:00.000Z',
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: '2026-09-15T09:48:00.000Z',
    },
    spent: { used: 38_412, size: 200_000 },
    steps: [
      step({
        kind: 'thought',
        status: null,
        text: 'The worker redeploy may have left jobs behind in the retry queues.',
      }),
      step({ tool: 'grep', text: 'retry_queue in services/worker' }),
      step({
        tool: 'execute',
        text: 'queue-stats --all',
        detail: 'webhook-retries  1204\nbilling-retries    87',
      }),
    ],
  },
  {
    runId: 'run_retries_2',
    attempt: 1,
    ms: 1_064_000,
    spans: [],
    marks: {
      startedAt: '2026-09-15T10:13:00.000Z',
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: '2026-09-15T10:31:00.000Z',
    },
    spent: { used: 61_950, size: 200_000 },
    steps: [
      step({
        tool: 'execute',
        text: 'queue-drain webhook-retries',
        detail: 'replayed 1201\nfailed 3 (410 Gone)',
      }),
      step({ tool: 'read', text: 'services/worker/retry.ts' }),
    ],
  },
];

const station = (
  key: keyof typeof STATIONS,
  kind: StationResponseDto['kind'],
): StationResponseDto => ({
  id: `station_${key}`,
  key,
  ...STATIONS[key],
  description: null,
  harness: 'claude-code',
  model: 'claude-opus-5',
  effort: 'high',
  agentPrompt: null,
  kind,
  skills: [],
});

const LINES: LineResponseDto[] = [
  {
    id: 'line_delivery',
    key: 'delivery',
    name: 'Delivery',
    stations: [
      station('triage', 'backlog'),
      station('spec', 'work'),
      station('implementation', 'work'),
      station('review', 'completed'),
    ],
    reactions: [],
    repositories: ['acme/api', 'acme/worker'],
  },
];

const TASKS: TaskResponseDto[] = [
  {
    id: 'task_retries',
    stationId: 'station_implementation',
    title: 'Drain the stuck retry queues',
    description: null,
    attachments: [],
    createdAt: '2026-09-15T08:05:00.000Z',
    running: false,
    awaitingReview: null,
    pullRequest: null,
    raisedBy: null,
    assignee: null,
    note: null,
    labels: [],
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

const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  role: 'owner',
  teams: [{ id: TEAM_ID, name: 'Platform' }],
};

export const seedInbox = (client: QueryClient) => {
  client.setQueryData(inboxKeys.forWorkspace(SLUG), INBOX);
  client.setQueryData(journalKeys.forTask('task_retries'), JOURNAL);
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(taskKeys.forTeam(TEAM_ID), TASKS);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.all, HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), [
    { fullName: 'acme/api' },
    { fullName: 'acme/worker' },
  ]);
};

export const emptyInbox = (client: QueryClient) => {
  client.setQueryData(inboxKeys.forWorkspace(SLUG), []);
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
};

export const failInbox = (client: QueryClient) =>
  failQuery(client, inboxKeys.forWorkspace(SLUG));
