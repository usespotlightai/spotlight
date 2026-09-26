import type { QueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  ChatResponseDto,
  HarnessResponseDto,
  JournalStepResponseDto,
  RunJournalResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const CHAT_ID = 'chat_backoff';

const RUN_ID = 'run_chat_1';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const CHAT: ChatResponseDto = {
  id: CHAT_ID,
  title: 'Plan the retry backoff',
  harness: 'claude-code',
  model: 'claude-opus-5',
  effort: 'high',
  repositories: ['acme/worker'],
  createdAt: minutesAgo(30),
  updatedAt: minutesAgo(25),
  working: false,
  runId: null,
  messages: [
    {
      position: 0,
      kind: 'said',
      body: 'Webhook retries hammer endpoints that are already down. Help me plan a backoff that gives them room to recover.',
      at: minutesAgo(30),
      author: { id: 'user_1', name: 'Sam Rivera', image: null },
      runId: null,
      attachments: [],
      traces: [
        {
          taskId: 'task_retries',
          title: 'Retry webhook deliveries that time out',
        },
      ],
      proposal: null,
    },
    {
      position: 1,
      kind: 'proposed',
      body: '',
      at: minutesAgo(25),
      author: null,
      runId: RUN_ID,
      attachments: [],
      traces: [],
      proposal: {
        lineId: 'line_delivery',
        lineName: 'Delivery',
        stationId: 'station_spec',
        stationName: 'Spec',
        stationColor: '#b36ae2',
        title: 'Back off exponentially on webhook retries',
        description:
          'Double the wait after each failed delivery, capped at an hour, and stop after a `410 Gone`.',
        state: 'open',
        taskId: null,
      },
    },
  ],
};

const step = (
  over: Partial<JournalStepResponseDto> & { text: string; startedAt: string },
): JournalStepResponseDto => ({
  kind: 'tool',
  status: 'completed',
  tool: null,
  detail: null,
  ms: 1_200,
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
    ms: 240_000,
    spans: [],
    marks: {
      startedAt: minutesAgo(29),
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: minutesAgo(25),
    },
    spent: { used: 21_400, size: 200_000 },
    steps: [
      step({
        kind: 'thought',
        status: null,
        text: 'The retry schedule lives in the worker.',
        startedAt: minutesAgo(29),
      }),
      step({
        tool: 'read',
        text: 'services/worker/retry.ts',
        startedAt: minutesAgo(28),
      }),
      step({
        kind: 'said',
        status: null,
        text: 'Retries run every 30 seconds with no ceiling, so a dead endpoint is hit 120 times an hour. An exponential backoff capped at an hour brings that down to about a dozen.',
        startedAt: minutesAgo(26),
      }),
    ],
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
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), [
    { fullName: 'acme/api' },
    { fullName: 'acme/worker' },
  ]);
};

export const seedChat = (client: QueryClient) => {
  seedAround(client);
  client.setQueryData(chatKeys.one(CHAT_ID), CHAT);
  client.setQueryData(chatKeys.journal(CHAT_ID), JOURNAL);
};

export const emptyChat = (client: QueryClient) => {
  seedAround(client);
  client.setQueryData(chatKeys.one(CHAT_ID), {
    ...CHAT,
    title: 'New chat',
    messages: [],
  });
  client.setQueryData(chatKeys.journal(CHAT_ID), []);
};

export const failChat = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, chatKeys.one(CHAT_ID));
};
