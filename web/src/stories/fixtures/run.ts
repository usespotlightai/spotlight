import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { runConversationKeys } from '@/hooks/api/useRunConversation';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import { taskKeys } from '@/hooks/api/useTasks';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  JournalStepResponseDto,
  LineResponseDto,
  RunConversationResponseDto,
  RunJournalResponseDto,
  RunStationResponseDto,
  StationResponseDto,
  TaskResponseDto,
  TeamRunResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const RUN_ID = 'run_retries_2';

export const TASK_ID = 'task_retries';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const IMPLEMENTATION: RunStationResponseDto = {
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

const seedAround = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(taskKeys.forTeam(TEAM_ID), TASKS);
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
};

export const failRun = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, teamRunKeys.forTeam(TEAM_ID));
};
