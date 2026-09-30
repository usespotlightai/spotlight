import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { runConfigKeys } from '@/hooks/api/useRunConfig';
import { runConversationKeys } from '@/hooks/api/useRunConversation';
import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import { taskKeys } from '@/hooks/api/useTasks';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  JournalStepResponseDto,
  LineResponseDto,
  RunConfigResponseDto,
  RunConversationResponseDto,
  RunJournalResponseDto,
  RunStationResponseDto,
  StationResponseDto,
  TaskResponseDto,
  TeamRunResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import {
  failRunMemories,
  seedNoRunMemories,
  seedRunMemories,
} from '@/stories/fixtures/run-memories';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const RUN_ID = 'run_retries_2';

export const TASK_ID = 'task_retries';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const IMPLEMENTATION: RunStationResponseDto = {
  id: 'station_implementation',
  name: 'Implementation',
  color: '#5c66d9',
  position: 2,
  count: 4,
};

const RUN: TeamRunResponseDto = {
  id: RUN_ID,
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: minutesAgo(40),
  updatedAt: minutesAgo(22),
  harness: 'claude-code',
  image: null,
  station: IMPLEMENTATION,
  review: null,
  taskId: TASK_ID,
  taskTitle: 'Drain the stuck retry queues',
  taskDescription:
    'Webhook deliveries have been failing since the queue worker was redeployed on Friday.',
};

const CONVERSATION: RunConversationResponseDto = {
  runId: RUN_ID,
  taskId: TASK_ID,
  title: 'Drain the stuck retry queues',
  description:
    'Webhook deliveries have been failing since the queue worker was redeployed on Friday.',
  attachments: [],
  station: IMPLEMENTATION,
  createdAt: minutesAgo(40),
  briefing:
    '## Implementation\n\nYou are the Implementation station of the Delivery line. Carry out the change the spec settled on, keep the pull request small, and hand over once the tests pass.\n\n## The task\n\nDrain the stuck retry queues. Webhook deliveries have been failing since the queue worker was redeployed on Friday.\n\n## What came before\n\nMaya Chen answered: start with webhook-retries. Billing is still being reconciled, so leave it alone for now.',
  working: false,
  spend: {
    cost: 1.8742,
    currency: 'USD',
    inputTokens: 3_120,
    outputTokens: 18_840,
    cacheReadTokens: 2_412_300,
    cacheWriteTokens: 61_400,
  },
  notes: [
    {
      position: 0,
      kind: 'asked',
      form: 'words',
      voice: 'station',
      station: IMPLEMENTATION.name,
      stationColor: IMPLEMENTATION.color,
      stationPosition: IMPLEMENTATION.position,
      runId: RUN_ID,
      body: 'Drained `webhook-retries`: 1,201 jobs replayed and 3 failed again with a `410 Gone` from endpoints that no longer exist.\n\nShould I open a pull request that stops retrying after a `410`?',
      attachments: [],
      approval: null,
      failure: null,
      at: minutesAgo(22),
      author: null,
    },
  ],
};

const step = (
  over: Partial<JournalStepResponseDto> & { text: string },
): JournalStepResponseDto => ({
  kind: 'tool',
  status: 'completed',
  tool: null,
  detail: null,
  ms: 1_200,
  startedAt: minutesAgo(38),
  locations: [],
  given: null,
  returned: null,
  change: null,
  ...over,
});

const JOURNAL: RunJournalResponseDto[] = [
  {
    runId: RUN_ID,
    attempt: 1,
    ms: 1_064_000,
    spans: [],
    marks: {
      startedAt: minutesAgo(40),
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: minutesAgo(22),
    },
    spent: { used: 61_950, size: 200_000 },
    steps: [
      step({
        kind: 'thought',
        status: null,
        text: 'The webhook queue is the one to drain first.',
      }),
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
      station('triage', 'Triage', '#edc12b', 0, 'backlog'),
      station('spec', 'Spec', '#b36ae2', 1, 'work'),
      station('implementation', 'Implementation', '#5c66d9', 2, 'work'),
      station('review', 'Code Review', '#56b98d', 3, 'completed'),
    ],
    reactions: [],
    repositories: ['acme/api', 'acme/worker'],
  },
];

const TASKS: TaskResponseDto[] = [
  {
    id: TASK_ID,
    stationId: 'station_implementation',
    revision: 0,
    title: 'Drain the stuck retry queues',
    description: null,
    attachments: [],
    createdAt: minutesAgo(90),
    running: false,
    awaitingReview: null,
    pullRequest: null,
    raisedBy: null,
    assignee: null,
    note: null,
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

const FINGERPRINT =
  '3f2a9c1e5b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9';

const CONFIG: RunConfigResponseDto = {
  fingerprint: FINGERPRINT,
  config: {
    prompt: 'Implement the spec on the task.',
    harness: 'claude-code',
    model: 'claude-opus-5',
    effort: 'xhigh',
    profile: null,
    image: null,
    repositories: [{ name: 'acme/worker', setup: 'npm ci' }],
    skills: [{ key: 'reviewing', digest: 'c0ffee' }],
    tools: [],
    decisions: true,
    memories: true,
    judge: null,
  },
  changedSince: null,
};

const seedAround = (
  client: QueryClient,
  standing: Partial<TaskResponseDto> = {},
) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(runConfigKeys.forRun(RUN_ID), CONFIG);
  client.setQueryData(
    taskKeys.forTeam(TEAM_ID),
    TASKS.map((each) => ({ ...each, ...standing })),
  );
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), [
    { fullName: 'acme/api' },
    { fullName: 'acme/worker' },
  ]);
};

export const seedRun = (client: QueryClient) => {
  seedAround(client);
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), [RUN]);
  client.setQueryData(runConversationKeys.forRun(RUN_ID), CONVERSATION);
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  seedRunMemories(client, TEAM_ID, RUN_ID);
};

const OWED = { state: 'owed', conversationId: `${TASK_ID}:0` } as const;

const seedPausedRun = (
  client: QueryClient,
  state: 'waiting' | 'parked',
  updatedAt: string,
) => {
  seedAround(client, {
    running: true,
    awaitingReview: { conversationId: OWED.conversationId },
  });
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), [
    { ...RUN, state, exitCode: null, updatedAt, review: OWED },
  ]);
  client.setQueryData(runConversationKeys.forRun(RUN_ID), {
    ...CONVERSATION,
    spend: null,
  });
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  seedRunMemories(client, TEAM_ID, RUN_ID);
};

export const seedWaitingRun = (client: QueryClient) =>
  seedPausedRun(client, 'waiting', minutesAgo(22));

export const seedParkedRun = (client: QueryClient) =>
  seedPausedRun(client, 'parked', minutesAgo(7));

const ANSWER = {
  position: 1,
  kind: 'answered',
  form: 'words',
  voice: 'person',
  station: IMPLEMENTATION.name,
  stationColor: IMPLEMENTATION.color,
  stationPosition: IMPLEMENTATION.position,
  runId: null,
  body: 'Yes, open it. Leave the billing queue alone for now.',
  attachments: [],
  approval: null,
  failure: null,
  at: minutesAgo(6),
  author: { id: 'user_maya', name: 'Maya Chen', image: null },
} as const satisfies RunConversationResponseDto['notes'][number];

const CARRIED_ON: RunJournalResponseDto = {
  runId: RUN_ID,
  attempt: 2,
  ms: null,
  spans: [],
  marks: {
    startedAt: minutesAgo(5),
    readyAt: null,
    spokeFrom: null,
    spokeTo: null,
    endedAt: null,
  },
  spent: null,
  steps: [
    step({
      tool: 'edit',
      text: 'services/worker/retry.ts',
      startedAt: minutesAgo(4),
    }),
    step({
      tool: 'execute',
      text: 'npm test -- retry',
      startedAt: minutesAgo(2),
      status: 'running',
    }),
  ],
};

export const seedCarryingOnRun = (client: QueryClient) => {
  seedAround(client, { running: true });
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), [
    {
      ...RUN,
      state: 'claimed',
      attempt: 2,
      exitCode: null,
      updatedAt: minutesAgo(5),
      review: { ...OWED, state: 'settled' },
    },
  ]);
  client.setQueryData(runConversationKeys.forRun(RUN_ID), {
    ...CONVERSATION,
    working: true,
    spend: null,
    notes: [...CONVERSATION.notes, ANSWER],
  });
  client.setQueryData(journalKeys.forTask(TASK_ID), [...JOURNAL, CARRIED_ON]);
  seedRunMemories(client, TEAM_ID, RUN_ID);
};

export const seedChangedConfigRun = (client: QueryClient) => {
  seedRun(client);
  client.setQueryData(runConfigKeys.forRun(RUN_ID), {
    ...CONFIG,
    changedSince: {
      runId: 'run_retries_1',
      taskId: 'task_webhooks',
      fingerprint:
        'b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c93f2a9c1e',
      changes: [
        {
          part: 'prompt',
          name: null,
          kind: 'changed',
          was: null,
          now: null,
        },
        {
          part: 'effort',
          name: null,
          kind: 'changed',
          was: 'high',
          now: 'xhigh',
        },
        {
          part: 'skill',
          name: 'reviewing',
          kind: 'added',
          was: null,
          now: null,
        },
        {
          part: 'memories',
          name: null,
          kind: 'changed',
          was: 'off',
          now: 'on',
        },
      ],
    },
  } satisfies RunConfigResponseDto);
};

export const seedPartlyReportedRun = (client: QueryClient) => {
  seedRun(client);
  client.setQueryData(runConversationKeys.forRun(RUN_ID), {
    ...CONVERSATION,
    spend: {
      cost: null,
      currency: null,
      inputTokens: 4_480,
      outputTokens: 12_210,
      cacheReadTokens: 988_160,
      cacheWriteTokens: null,
    },
  } satisfies RunConversationResponseDto);
};

export const rememberingRun = (client: QueryClient) => {
  seedRun(client);
  client.removeQueries({ queryKey: runMemoryKeys.forRun(TEAM_ID, RUN_ID) });
};

export const rememberedFailedRun = (client: QueryClient) => {
  seedRun(client);
  failRunMemories(client, TEAM_ID, RUN_ID);
};

export const emptyRun = (client: QueryClient) => {
  seedAround(client);
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), [
    { ...RUN, state: 'failed', exitCode: 1, updatedAt: minutesAgo(39) },
  ]);
  client.setQueryData(runConversationKeys.forRun(RUN_ID), {
    ...CONVERSATION,
    notes: [],
  });
  client.setQueryData(journalKeys.forTask(TASK_ID), []);
  seedNoRunMemories(client, TEAM_ID, RUN_ID);
};

export const failRun = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, teamRunKeys.forTeam(TEAM_ID));
};
