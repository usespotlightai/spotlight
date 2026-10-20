import type {
  ChatMessageResponseDto,
  ChatProposalResponseDto,
  ChatResponseDto,
  JournalStepResponseDto,
  RunJournalResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import {
  DELIVERY_ID,
  GROWTH_ID,
  PLATFORM_ID,
  perWorld,
  world,
} from '@/mocks/world';
import { PRIYA, SAM } from '@/mocks/world/people';

export type ChatRecord = {
  chat: ChatResponseDto;
  journals: RunJournalResponseDto[];
};

const STEP_SECONDS = 25;

const secondsAfter = (at: string, seconds: number): string =>
  new Date(Date.parse(at) + seconds * 1_000).toISOString();

export type StepDraft = Pick<JournalStepResponseDto, 'kind' | 'text'> &
  Partial<Pick<JournalStepResponseDto, 'tool' | 'detail'>>;

const journalStep = (
  draft: StepDraft,
  startedAt: string,
): JournalStepResponseDto => ({
  status: draft.kind === 'tool' ? 'completed' : null,
  tool: null,
  detail: null,
  ms: draft.kind === 'tool' ? 1_800 : 0,
  locations: [],
  input: null,
  output: null,
  change: null,
  ...draft,
  startedAt,
});

export const chatTurn = (
  runId: string,
  sentAt: string,
  steps: readonly StepDraft[],
): RunJournalResponseDto => {
  const startedAt = secondsAfter(sentAt, 8);
  const endedAt = secondsAfter(startedAt, steps.length * STEP_SECONDS + 5);

  return {
    runId,
    attempt: 1,
    ms: Date.parse(endedAt) - Date.parse(startedAt),
    spans: [],
    marks: {
      startedAt,
      readyAt: secondsAfter(startedAt, 3),
      firstAgentUpdateAt: secondsAfter(startedAt, 4),
      lastAgentUpdateAt: endedAt,
      endedAt,
    },
    spent: {
      used: 6_000 + steps.length * 3_100,
      size: 200_000,
      cost: null,
      currency: null,
    },
    steps: steps.map((each, at) =>
      journalStep(each, secondsAfter(startedAt, 5 + at * STEP_SECONDS)),
    ),
  };
};

export const turnEndsAt = (journal: RunJournalResponseDto): string =>
  journal.marks.endedAt ?? new Date().toISOString();

export const messageBy = (
  author: ChatMessageResponseDto['author'],
  position: number,
  body: string,
  at: string,
  traces: ChatMessageResponseDto['traces'] = [],
): ChatMessageResponseDto => ({
  position,
  kind: 'message',
  body,
  at,
  author,
  runId: null,
  attachments: [],
  traces,
  proposal: null,
});

const proposalAt = (
  teamId: string,
  stationId: string,
  over: Pick<ChatProposalResponseDto, 'title' | 'description'> &
    Partial<Pick<ChatProposalResponseDto, 'state' | 'taskId'>>,
): ChatProposalResponseDto => {
  const line = world().lines[teamId]?.find((each) =>
    each.stations.some((station) => station.id === stationId),
  );
  const station = line?.stations.find((each) => each.id === stationId);

  return {
    lineId: line?.id ?? '',
    lineName: line?.name ?? null,
    stationId,
    stationName: station?.name ?? null,
    stationColor: station?.color ?? null,
    stationPosition: station?.position ?? null,
    stationCount: line?.stations.length ?? null,
    state: 'open',
    taskId: null,
    ...over,
  };
};

const proposed = (
  position: number,
  runId: string,
  at: string,
  proposal: ChatProposalResponseDto,
): ChatMessageResponseDto => ({
  position,
  kind: 'proposed',
  body: '',
  at,
  author: null,
  runId,
  attachments: [],
  traces: [],
  proposal,
});

const chatOf = (
  over: Pick<ChatResponseDto, 'id' | 'title' | 'createdAt' | 'messages'> &
    Partial<ChatResponseDto>,
): ChatResponseDto => ({
  harness: 'claude-code',
  model: null,
  effort: null,
  repositories: [],
  targetStation: null,
  setup: null,
  updatedAt: over.createdAt,
  working: false,
  queued: false,
  runId: null,
  ...over,
});

const retriesChat = (): ChatRecord => {
  const sentAt = hoursAgo(31);
  const first = chatTurn('run_chat_retries_1', sentAt, [
    {
      kind: 'thought',
      text: 'The retry schedule and the queue consumers both live in the worker.',
    },
    { kind: 'tool', tool: 'read', text: 'src/retries/deliver.ts' },
    { kind: 'tool', tool: 'read', text: 'src/retries/worker.ts' },
    {
      kind: 'tool',
      tool: 'bash',
      text: 'kubectl -n worker get deploy retry-worker -o yaml | rg RETRY_CONCURRENCY',
    },
    {
      kind: 'message',
      text: 'Retries pile up because Friday’s redeploy brought the retry worker back without `RETRY_CONCURRENCY`, so it takes no jobs at all: 1,204 sit in `webhook-retries` and 87 in `billing-retries`.\n\nOn top of that, endpoints that answer `410 Gone` are retried forever, so the queue never drains on its own. I would drain the stuck queues first, then add an alert so this cannot go quiet again.',
    },
  ]);
  const proposedAt = turnEndsAt(first);
  const followed = hoursAgo(1);
  const second = chatTurn('run_chat_retries_2', followed, [
    { kind: 'tool', tool: 'read', text: 'src/billing/reconcile.ts' },
    {
      kind: 'message',
      text: 'Leave `billing-retries` alone until billing is reconciled: replaying those jobs now would charge some customers twice. Drain `webhook-retries` first, and watch the dead-letter count while you do. It should fall by about 1,200 an hour.',
    },
  ]);

  return {
    chat: chatOf({
      id: 'chat_retries',
      title: 'Why do retries pile up?',
      model: 'claude-opus-5',
      effort: 'high',
      repositories: ['acme/worker'],
      createdAt: sentAt,
      updatedAt: turnEndsAt(second),
      messages: [
        messageBy(
          SAM,
          0,
          'Why do retries pile up? Webhook deliveries have been failing since Friday’s deploy.',
          sentAt,
        ),
        proposed(
          1,
          'run_chat_retries_1',
          proposedAt,
          proposalAt(PLATFORM_ID, 'station_triage', {
            title: 'Drain the stuck retry queues',
            description:
              'Restore `RETRY_CONCURRENCY` on the worker, replay what can still be delivered, and stop retrying endpoints that answer `410 Gone`.',
            state: 'created',
            taskId: 'task_retries',
          }),
        ),
        proposed(
          2,
          'run_chat_retries_1',
          secondsAfter(proposedAt, 2),
          proposalAt(PLATFORM_ID, 'station_spec', {
            title: 'Alert when a retry queue has jobs older than an hour',
            description:
              'Page whoever is on call when the oldest job in any retry queue is more than an hour old.',
          }),
        ),
        proposed(
          3,
          'run_chat_retries_1',
          secondsAfter(proposedAt, 4),
          proposalAt(PLATFORM_ID, 'station_backlog', {
            title: 'Show retry history on the webhook page',
            description: null,
            state: 'dismissed',
          }),
        ),
        messageBy(
          SAM,
          4,
          'The drain is under way. Anything to watch for while billing is being reconciled?',
          followed,
          [{ taskId: 'task_retries', title: 'Drain the stuck retry queues' }],
        ),
      ],
    }),
    journals: [first, second],
  };
};

const implementationChat = (): ChatRecord => {
  const sentAt = hoursAgo(5);
  const answer = chatTurn('run_chat_small_prs_1', sentAt, [
    {
      kind: 'thought',
      text: 'The chat is about the station’s recent runs, so I start with the reviews that sent work back.',
    },
    {
      kind: 'tool',
      tool: 'bash',
      text: 'spotlight runs --station implementation --last 10',
    },
    {
      kind: 'tool',
      tool: 'bash',
      text: 'gh pr view 431 --repo acme/api --json additions,deletions',
    },
    {
      kind: 'message',
      text: 'Two of the last runs were sent back for size, and the Postgres driver upgrade mixed a migration that rewrites 1.3M invoice rows into the same pull request.\n\nI would add this to the Implementation prompt:\n\n> Before opening a pull request, count the changed lines. Above 400, split the work into a stack, and always put migrations in a pull request of their own.\n\nThat matches what the team already requires in memory M-47.',
    },
  ]);

  return {
    chat: chatOf({
      id: 'chat_small_prs',
      title: 'Make Implementation keep pull requests small',
      repositories: ['acme/api'],
      targetStation: {
        lineId: DELIVERY_ID,
        lineKey: 'delivery',
        lineName: 'Delivery',
        stationId: 'station_implementation',
        stationKey: 'implementation',
        stationName: 'Implementation',
      },
      createdAt: sentAt,
      updatedAt: turnEndsAt(answer),
      messages: [
        messageBy(
          SAM,
          0,
          'Its last runs were sent back twice for sprawling diffs. What should it do better?',
          sentAt,
        ),
      ],
    }),
    journals: [answer],
  };
};

const rateLimitsChat = (): ChatRecord => {
  const sentAt = hoursAgo(52);
  const answer = chatTurn('run_chat_rate_limits_1', sentAt, [
    { kind: 'tool', tool: 'read', text: 'src/http/middleware/index.ts' },
    {
      kind: 'message',
      text: 'There is no limit today: three partner tokens send up to 1,800 requests in the first minute after their nightly sync. A token bucket per API token, 600 requests a minute with bursts of 100, would cover every partner’s normal traffic and leave the dashboard alone, since it uses session cookies.',
    },
  ]);
  const proposedAt = turnEndsAt(answer);

  return {
    chat: chatOf({
      id: 'chat_rate_limits',
      title: 'Rate limiting for the public API',
      repositories: ['acme/api'],
      createdAt: sentAt,
      updatedAt: secondsAfter(proposedAt, 2),
      messages: [
        messageBy(
          SAM,
          0,
          'Partners hit the public API in bursts. How should we limit them without breaking the dashboard?',
          sentAt,
        ),
        proposed(
          1,
          'run_chat_rate_limits_1',
          proposedAt,
          proposalAt(PLATFORM_ID, 'station_triage', {
            title: 'Add rate limiting to the public API',
            description:
              'A token bucket per API token: 600 requests a minute, bursts of 100. Session-cookie requests are exempt.',
            state: 'created',
            taskId: 'task_rate_limits',
          }),
        ),
        proposed(
          2,
          'run_chat_rate_limits_1',
          secondsAfter(proposedAt, 2),
          proposalAt(PLATFORM_ID, 'station_backlog', {
            title: 'Publish the rate limits in the API docs',
            description:
              'Document the limits and the `Retry-After` header before the limits go live.',
          }),
        ),
      ],
    }),
    journals: [answer],
  };
};

const quarterChat = (): ChatRecord => {
  const sentAt = hoursAgo(98);
  const answer = chatTurn('run_chat_quarter_1', sentAt, [
    {
      kind: 'tool',
      tool: 'bash',
      text: 'spotlight tasks --team platform --done --since 90d',
    },
    {
      kind: 'message',
      text: 'Most of last quarter went to incidents on the worker fleet. Three themes are important for next quarter:\n\n1. **Queues**: retries, dead letters and alerts on queue age.\n2. **Postgres**: the driver upgrade and connection pooling.\n3. **Public API**: rate limits and published docs.',
    },
  ]);

  return {
    chat: chatOf({
      id: 'chat_quarter',
      title: 'What should the platform team take on next quarter?',
      harness: 'codex',
      createdAt: sentAt,
      updatedAt: turnEndsAt(answer),
      messages: [
        messageBy(
          SAM,
          0,
          'What should the platform team take on next quarter?',
          sentAt,
        ),
      ],
    }),
    journals: [answer],
  };
};

const onboardingChat = (): ChatRecord => {
  const sentAt = hoursAgo(22);
  const answer = chatTurn('run_chat_onboarding_1', sentAt, [
    { kind: 'tool', tool: 'read', text: 'src/onboarding/Checklist.tsx' },
    {
      kind: 'message',
      text: 'The checklist has seven steps and 38% of new workspaces stop at step four, “Invite your team”. Cutting it to four steps, with inviting moved to the end, is worth an experiment.',
    },
  ]);
  const proposedAt = turnEndsAt(answer);

  return {
    chat: chatOf({
      id: 'chat_onboarding',
      title: 'Shorten the onboarding checklist',
      repositories: ['acme/web'],
      createdAt: sentAt,
      updatedAt: proposedAt,
      messages: [
        messageBy(
          PRIYA,
          0,
          'New workspaces drop off during onboarding. Where would you cut?',
          sentAt,
        ),
        proposed(
          1,
          'run_chat_onboarding_1',
          proposedAt,
          proposalAt(GROWTH_ID, 'station_design', {
            title: 'Test a shorter onboarding checklist',
            description:
              'Four steps instead of seven, with inviting the team moved to the end. Half of new workspaces see it.',
            state: 'created',
            taskId: 'task_onboarding_copy',
          }),
        ),
      ],
    }),
    journals: [answer],
  };
};

const SETUP_PULL_REQUEST = 'https://github.com/acme/infra/pull/12';

const setupChat = (): ChatRecord => {
  const sentAt = hoursAgo(4300);
  const answer = chatTurn('run_chat_setup_1', sentAt, [
    { kind: 'tool', tool: 'read', text: 'api/.github/workflows/ci.yml' },
    { kind: 'tool', tool: 'bash', text: 'spotlight linear.labels' },
    {
      kind: 'message',
      text: 'The API runs `npm test` and `npm run lint` in CI, and Linear issues are triaged with the `bug`, `feature` and `chore` labels. I adapted the triage prompt to those labels and gave Implementation the CI commands as its check.\n\nThe pull request is open: https://github.com/acme/infra/pull/12',
    },
  ]);

  return {
    chat: chatOf({
      id: 'chat_setup',
      title:
        'Set up our configuration as code in acme/infra, under spotlight/.',
      repositories: ['acme/infra', 'acme/api'],
      setup: {
        repository: 'acme/infra',
        folder: 'spotlight',
        pullRequest: SETUP_PULL_REQUEST,
      },
      createdAt: sentAt,
      updatedAt: turnEndsAt(answer),
      messages: [
        messageBy(
          SAM,
          0,
          'Set up our configuration as code in acme/infra, under spotlight/.',
          sentAt,
        ),
      ],
    }),
    journals: [answer],
  };
};

const seededChats = (): Record<string, ChatRecord[]> => ({
  [PLATFORM_ID]: [
    setupChat(),
    retriesChat(),
    implementationChat(),
    rateLimitsChat(),
    quarterChat(),
  ],
  [GROWTH_ID]: [onboardingChat()],
});

export const teamChats = perWorld(
  (kind): Record<string, ChatRecord[]> =>
    kind === 'empty' ? { [PLATFORM_ID]: [], [GROWTH_ID]: [] } : seededChats(),
);
