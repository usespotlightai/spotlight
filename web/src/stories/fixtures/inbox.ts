import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { inboxKeys } from '@/hooks/api/useInbox';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { runConversationKeys } from '@/hooks/api/useRunConversation';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import { taskKeys } from '@/hooks/api/useTasks';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  InboxItemResponseDto,
  InboxMessageResponseDto,
  InboxNoticeResponseDto,
  InboxStationResponseDto,
  JournalStepResponseDto,
  LineResponseDto,
  RunConversationResponseDto,
  RunJournalResponseDto,
  StationResponseDto,
  TaskResponseDto,
  TeamRunResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { HARNESSES } from '@/stories/fixtures/harnesses';
import {
  MEMORIES_ITEM_ID,
  RUN_ID as MEMORIES_RUN_ID,
  seedMemoryReview,
} from '@/stories/fixtures/memories';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const OPENED_ITEM_ID = 'task_retries:0';

export const APPROVAL_ITEM_ID = 'task_release_note:0';

export const FAILING_ITEM_ID = 'task_nightly_build:0';

export const CONNECTION_ITEM_ID = 'task_linear_update:0';

export const NOTICE_ID = 'notice_search_stalled';

export { MEMORIES_ITEM_ID };

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
    approval: null,
    failure: null,
    connection: null,
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
    failure: null,
    aside: null,
    ...rest,
    kind: 'task',
  };
};

const NOTICE: InboxNoticeResponseDto = {
  kind: 'notice',
  id: NOTICE_ID,
  teamId: TEAM_ID,
  form: 'ended',
  headline:
    'The search for a better Implementation config stalled: nothing left the config can fix',
  points: [
    'Two iterations in a row found nothing better, so its agent looked into the 3 tasks the best config so far still fails, and found none a change to the config could fix. The search ended, keeping what it did not spend.',
    'Take the task out of the replay set, or reword it (Flaky checkout test on CI): it asks for a fix the codebase already has, so every candidate fails it.',
    'Fix the judge’s rubric (Drain the stuck retry queues): it wants a test for every change, but the change only renames a queue.',
    'Fix the station’s check (Upgrade the Postgres driver): the integration test needs a database the runner never starts.',
  ],
  link: 'lines/line_delivery/stations/station_implementation/searches/search_queue_fixes',
  linkLabel: 'Open the search',
  askedAt: '2026-09-15T11:30:00.000Z',
  unread: true,
  resolved: false,
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
    id: MEMORIES_ITEM_ID,
    taskId: 'task_retries',
    title: 'Drain the stuck retry queues',
    at: STATIONS.implementation,
    askedAt: '2026-09-15T10:40:00.000Z',
    unread: true,
    aside: { form: 'memories', about: MEMORIES_RUN_ID },
    notes: [],
  }),
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
    taskId: 'task_release_note',
    title: 'Tell the reporter the queue is drained',
    at: STATIONS.implementation,
    notes: [
      said({
        position: 0,
        runId: 'run_release_note_1',
        form: 'approval',
        at: '2026-09-15T11:10:00.000Z',
        body: 'I need your approval before I use `linear.comment`.',
        approval: {
          kind: 'tool-call',
          name: 'linear.comment',
          because: 'It posts publicly on the issue, under the team’s name.',
          inputs: [
            { name: 'issue', value: 'ENG-412' },
            {
              name: 'body',
              value:
                'Drained webhook-retries: 1,201 jobs replayed. Three endpoints are gone for good and have been dropped.',
            },
          ],
          standing: 'asked',
          edited: null,
          intent:
            'post the drain summary on the issue, publicly under the team’s name',
        },
      }),
    ],
  }),
  waiting({
    taskId: 'task_nightly_build',
    title: 'Fix the nightly build',
    at: STATIONS.implementation,
    failure: { source: 'run', code: 'exited', occurrences: 3 },
    notes: [
      said({
        position: 0,
        form: 'failure',
        runId: 'run_nightly_build_3',
        at: '2026-09-15T10:52:00.000Z',
        body: 'The run exited before it finished. It has failed the same way three times now.',
        failure: { source: 'run', code: 'exited', occurrences: 3 },
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
    spent: { used: 38_412, size: 200_000, cost: null, currency: null },
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
    spent: { used: 61_950, size: 200_000, cost: null, currency: null },
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

const RELEASE_NOTE_JOURNAL: RunJournalResponseDto[] = [
  {
    runId: 'run_release_note_1',
    attempt: 1,
    ms: 96_000,
    spans: [],
    marks: {
      startedAt: '2026-09-15T11:08:00.000Z',
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: '2026-09-15T11:10:00.000Z',
    },
    spent: { used: 21_304, size: 200_000, cost: null, currency: null },
    steps: [
      step({
        kind: 'thought',
        status: null,
        text: 'The reporter is waiting on ENG-412, so the drain should be written up there.',
      }),
      step({
        tool: 'execute',
        text: 'spotlight linear comment --issue ENG-412',
      }),
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
  judge: null,
  alerts: [],
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
    source: null,
    replayCheck: null,
  },
];

const TASKS: TaskResponseDto[] = [
  {
    id: 'task_retries',
    stationId: 'station_implementation',
    title: 'Drain the stuck retry queues',
    description: null,
    attachments: [],
    revision: 0,
    createdAt: '2026-09-15T08:05:00.000Z',
    running: false,
    awaitingReview: null,
    pullRequest: null,
    raisedBy: null,
    assignee: null,
    note: null,
  },
];

const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  role: 'owner',
  teams: [{ id: TEAM_ID, name: 'Platform' }],
};

const retries = INBOX.find((each) => each.id === OPENED_ITEM_ID);

const RETRIES_RUN: RunConversationResponseDto = {
  runId: MEMORIES_RUN_ID,
  taskId: 'task_retries',
  title: retries?.title ?? '',
  description: retries?.description ?? null,
  attachments: [],
  station: {
    id: 'station_implementation',
    ...STATIONS.implementation,
    count: 4,
  },
  createdAt: retries?.createdAt ?? '',
  briefing: [retries?.title, retries?.description].filter(Boolean).join('\n\n'),
  working: false,
  notes: retries?.notes ?? [],
  spend: null,
};

const RETRIES_TEAM_RUN: TeamRunResponseDto = {
  id: MEMORIES_RUN_ID,
  state: 'waiting',
  attempt: 1,
  exitCode: null,
  startedAt: '2026-09-15T10:13:00.000Z',
  updatedAt: '2026-09-15T10:31:00.000Z',
  harness: 'claude-code',
  image: null,
  station: RETRIES_RUN.station,
  review: { state: 'owed', conversationId: OPENED_ITEM_ID },
  taskId: 'task_retries',
  taskTitle: RETRIES_RUN.title,
  taskDescription: RETRIES_RUN.description,
};

const seedRetriesRun = (client: QueryClient) => {
  client.setQueryData(runConversationKeys.forRun(MEMORIES_RUN_ID), RETRIES_RUN);
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), [RETRIES_TEAM_RUN]);
  client.setQueryData(journalKeys.forTask('task_retries'), JOURNAL);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
};

export const failRetriesRun = (client: QueryClient) => {
  client.setQueryData(journalKeys.forTask('task_retries'), JOURNAL);
  failQuery(client, runConversationKeys.forRun(MEMORIES_RUN_ID));
};

export const seedInbox = (client: QueryClient) => {
  seedRetriesRun(client);
  client.setQueryData(inboxKeys.forWorkspace(SLUG), [NOTICE, ...INBOX]);
  client.setQueryData(journalKeys.forTask('task_retries'), JOURNAL);
  client.setQueryData(
    journalKeys.forTask('task_release_note'),
    RELEASE_NOTE_JOURNAL,
  );
  client.setQueryData(journalKeys.forTask('task_nightly_build'), []);
  seedMemoryReview(client);
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(taskKeys.forTeam(TEAM_ID), TASKS);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), [
    { fullName: 'acme/api' },
    { fullName: 'acme/worker' },
  ]);
};

const DECIDED_AT = '2026-09-15T11:24:00.000Z';

const decided = (
  standing: 'granted' | 'refused',
  body: string,
): InboxItemResponseDto[] =>
  INBOX.map((item) =>
    item.taskId !== 'task_release_note'
      ? item
      : {
          ...item,
          askedAt: DECIDED_AT,
          notes: [
            ...item.notes.map((note) =>
              note.approval
                ? { ...note, approval: { ...note.approval, standing } }
                : note,
            ),
            said({
              position: item.notes.length,
              kind: 'answered',
              form: 'approval',
              voice: 'person',
              author: { id: 'user_2', name: 'Maya Chen', image: null },
              at: DECIDED_AT,
              body,
            }),
          ],
        },
  );

export const seedApproved = (client: QueryClient) => {
  seedInbox(client);
  client.setQueryData(inboxKeys.forWorkspace(SLUG), [
    NOTICE,
    ...decided('granted', 'Approved.'),
  ]);
};

export const seedDismissed = (client: QueryClient) => {
  seedInbox(client);
  client.setQueryData(inboxKeys.forWorkspace(SLUG), [
    NOTICE,
    ...decided(
      'refused',
      'Not before the release. Hold it until the fix is deployed on Thursday.',
    ),
  ]);
};

const CONNECTION_ASKED_AT = '2026-09-15T11:40:00.000Z';

const askedToConnect = (met: boolean): InboxItemResponseDto =>
  waiting({
    taskId: 'task_linear_update',
    title: 'Post the drain summary on ENG-412',
    at: STATIONS.implementation,
    resolved: met,
    notes: [
      said({
        position: 0,
        runId: 'run_linear_update_1',
        form: 'connection',
        at: CONNECTION_ASKED_AT,
        body: 'I need to use `linear.comment`, which acts as you in Linear, and you haven’t connected Linear yet.\n\nConnect Linear and I will carry on. Nothing has been sent yet.',
        connection: {
          source: 'linear',
          integration: 'Linear',
          personId: 'user_2',
          personName: 'Maya Chen',
          met,
        },
      }),
      ...(met
        ? [
            said({
              position: 1,
              kind: 'answered',
              voice: 'person',
              author: { id: 'user_2', name: 'Maya Chen', image: null },
              at: '2026-09-15T11:52:00.000Z',
              body: 'Connected Linear.',
            }),
          ]
        : []),
    ],
  });

const seedConnection = (met: boolean) => (client: QueryClient) => {
  seedInbox(client);
  client.setQueryData(inboxKeys.forWorkspace(SLUG), [
    NOTICE,
    askedToConnect(met),
    ...INBOX,
  ]);
  client.setQueryData(journalKeys.forTask('task_linear_update'), []);
};

export const seedConnectionAsked = seedConnection(false);

export const seedConnectionMet = seedConnection(true);

export const seedSettledNotice = (client: QueryClient) => {
  seedInbox(client);
  client.setQueryData(inboxKeys.forWorkspace(SLUG), [
    { ...NOTICE, unread: false, resolved: true },
    ...INBOX,
  ]);
};

export const emptyInbox = (client: QueryClient) => {
  client.setQueryData(inboxKeys.forWorkspace(SLUG), []);
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
};

export const failInbox = (client: QueryClient) =>
  failQuery(client, inboxKeys.forWorkspace(SLUG));
