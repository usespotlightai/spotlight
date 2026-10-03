import type { QueryClient } from '@tanstack/react-query';
import { lineKeys } from '@/hooks/api/useLines';
import { replayRunKeys } from '@/hooks/api/useReplayRun';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { searchKeys } from '@/hooks/api/useSearches';
import { searchRunKeys } from '@/hooks/api/useSearchRun';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import type {
  LineResponseDto,
  ReplaySetResponseDto,
  SearchCandidateResponseDto,
  SearchDetailResponseDto,
  SearchResponseDto,
  SearchRunResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { seedStationReplays } from '@/stories/fixtures/replays';
import { seedNoRunMemories } from '@/stories/fixtures/run-memories';
import {
  LINE_ID,
  STATION_ID,
  seedStation,
  seedStationPlace,
} from '@/stories/fixtures/station';
import { NOT_ON_TEAM, SLUG, TEAM_ID } from '@/stories/fixtures/team';

export { LINE_ID, SLUG, STATION_ID, TEAM_ID };

export const SEARCH_ID = 'search_queue_fixes';
export const SEARCH_RUN_ID = 'run_search_1';
const EARLIER_SEARCH_ID = 'search_first_try';
const SET_ID = 'set_search_tasks';

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const TASKS = [
  'Drain the stuck retry queues',
  'Document the webhook retry policy',
  'Fix the flaky billing test',
  'Warm the pricing cache on deploy',
  'Rename the billing worker',
  'Split the invoice job',
  'Retry refunds on timeout',
] as const;

const SET: ReplaySetResponseDto = {
  id: SET_ID,
  lineId: LINE_ID,
  stationId: STATION_ID,
  name: 'Billing work',
  createdAt: hoursAgo(80),
  stationGone: false,
  guardsChanges: true,
  entries: TASKS.map((title, place) => ({
    runId: `run_task_${place}`,
    taskId: `task_${place}`,
    title,
    state: 'completed',
    endedAt: hoursAgo(90 - place),
    addedAt: hoursAgo(80),
    refusal: null,
    reason: null,
  })),
};

const SMALL_SET: ReplaySetResponseDto = {
  ...SET,
  id: 'set_two_tasks',
  name: 'Two docs tasks',
  guardsChanges: false,
  entries: SET.entries.slice(0, 2),
};

const BUDGET = {
  iterations: 3,
  perIteration: 2,
  ceiling: { amount: 25, currency: 'USD' },
  concurrency: 4,
};

const AGENT = { harness: 'claude-code', model: 'opus', effort: 'high' };

const candidate = (
  over: Partial<SearchCandidateResponseDto> & {
    candidateId: string;
    name: string;
  },
): SearchCandidateResponseDto => ({
  seed: false,
  iteration: 1,
  hypothesis: null,
  fingerprint: null,
  changes: [],
  replayId: `replay_${over.candidateId}`,
  replayState: 'finished',
  heldOutReplayId: null,
  heldOutReplayState: null,
  searchScore: null,
  searchScored: 5,
  heldOutScore: null,
  costPerRun: null,
  spent: { amount: 0, currency: 'USD' },
  onFrontier: false,
  pullRequest: null,
  ...over,
});

const SEED = candidate({
  candidateId: 'candidate_seed',
  name: 'seed',
  seed: true,
  iteration: null,
  replayId: 'replay_seed',
  searchScore: 0.4,
  heldOutScore: 0.5,
  costPerRun: 0.38,
  spent: { amount: 2.66, currency: 'USD' },
  onFrontier: true,
});

const CANDIDATES: SearchCandidateResponseDto[] = [
  candidate({
    candidateId: 'candidate_tests_first',
    name: 'tests-first',
    hypothesis:
      'Runs fail when they change code before reading its tests. Asking it to read and run the tests first should lift success on the flaky-test tasks.',
    changes: [
      { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
    ],
    searchScore: 0.8,
    heldOutScore: 1,
    heldOutReplayId: 'replay_tests_first_held_out',
    heldOutReplayState: 'finished',
    costPerRun: 0.95,
    spent: { amount: 4.75, currency: 'USD' },
    onFrontier: true,
    pullRequest: {
      id: 'pr_1',
      state: 'opened',
      url: 'https://github.com/acme/config/pull/42',
      reason: null,
    },
  }),
  candidate({
    candidateId: 'candidate_medium_effort',
    name: 'medium-effort',
    hypothesis:
      'Most of these tasks are small. Medium effort should succeed as often for much less.',
    changes: [
      {
        part: 'effort',
        name: null,
        kind: 'changed',
        was: 'high',
        now: 'medium',
      },
    ],
    searchScore: 0.6,
    heldOutScore: 0.5,
    heldOutReplayId: 'replay_medium_effort_held_out',
    heldOutReplayState: 'finished',
    costPerRun: 0.41,
    spent: { amount: 2.05, currency: 'USD' },
    onFrontier: true,
    pullRequest: {
      id: 'pr_2',
      state: 'refused',
      url: null,
      reason: {
        code: 'computed-attribute',
        message: 'effort is set from a local, so it cannot be changed in place',
        attribute: 'effort',
        expression: 'local.effort',
        wanted: 'medium',
      },
    },
  }),
  candidate({
    candidateId: 'candidate_sonnet',
    name: 'sonnet',
    iteration: 2,
    hypothesis: 'A smaller model may be enough with the tests-first prompt.',
    changes: [
      { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
      {
        part: 'model',
        name: null,
        kind: 'changed',
        was: 'opus',
        now: 'sonnet',
      },
    ],
    searchScore: 0.4,
    costPerRun: 0.55,
    spent: { amount: 2.75, currency: 'USD' },
  }),
  candidate({
    candidateId: 'candidate_review_skill',
    name: 'review-skill',
    iteration: 2,
    hypothesis: 'Its own review pass should catch the missed edge cases.',
    changes: [
      {
        part: 'skill',
        name: 'self-review',
        kind: 'added',
        was: null,
        now: null,
      },
    ],
    searchScore: 0.6,
    costPerRun: null,
    spent: { amount: 1.1, currency: 'USD' },
  }),
];

const DETAIL: SearchDetailResponseDto = {
  id: SEARCH_ID,
  lineId: LINE_ID,
  stationId: STATION_ID,
  setId: SET_ID,
  state: 'finished',
  ending: 'iterations-spent',
  agent: AGENT,
  budget: BUDGET,
  spent: { amount: 19.4, currency: 'USD' },
  iterationsRun: 3,
  proposed: 4,
  best: {
    candidateId: 'candidate_tests_first',
    name: 'tests-first',
    seed: false,
    searchScore: 0.8,
    heldOutScore: 1,
    costPerRun: 0.95,
  },
  startedAt: hoursAgo(6),
  endedAt: hoursAgo(1),
  split: {
    searchedTasks: 5,
    heldOutTasks: 2,
    searched: SET.entries
      .slice(0, 5)
      .map(({ runId, taskId }) => ({ runId, taskId })),
    heldOut: SET.entries
      .slice(5)
      .map(({ runId, taskId }) => ({ runId, taskId })),
  },
  iterations: [
    {
      number: 1,
      runId: 'run_search_1',
      state: 'ended',
      attempts: 3,
      proposed: ['candidate_tests_first', 'candidate_medium_effort'],
      agentSpent: { spends: [{ amount: 0.62, currency: 'USD' }], unpriced: 0 },
    },
    {
      number: 2,
      runId: 'run_search_2',
      state: 'ended',
      attempts: 2,
      proposed: ['candidate_sonnet', 'candidate_review_skill'],
      agentSpent: { spends: [{ amount: 0.58, currency: 'USD' }], unpriced: 0 },
    },
    {
      number: 3,
      runId: 'run_search_3',
      state: 'failed',
      attempts: 0,
      proposed: [],
      agentSpent: null,
    },
  ],
  seed: SEED,
  candidates: CANDIDATES,
  frontier: [
    'candidate_seed',
    'candidate_medium_effort',
    'candidate_tests_first',
  ],
};

const summaryOf = (detail: SearchDetailResponseDto): SearchResponseDto => ({
  id: detail.id,
  lineId: detail.lineId,
  stationId: detail.stationId,
  setId: detail.setId,
  state: detail.state,
  ending: detail.ending,
  agent: detail.agent,
  budget: detail.budget,
  spent: detail.spent,
  iterationsRun: detail.iterationsRun,
  proposed: detail.proposed,
  best: detail.best,
  startedAt: detail.startedAt,
  endedAt: detail.endedAt,
});

const SUMMARY = summaryOf(DETAIL);

const EARLIER: SearchResponseDto = {
  ...SUMMARY,
  id: EARLIER_SEARCH_ID,
  state: 'stopped',
  ending: 'stopped',
  spent: { amount: 3.2, currency: 'USD' },
  iterationsRun: 1,
  proposed: 1,
  best: {
    candidateId: 'candidate_seed_earlier',
    name: 'seed',
    seed: true,
    searchScore: 0.4,
    heldOutScore: null,
    costPerRun: 0.82,
  },
  startedAt: hoursAgo(50),
  endedAt: hoursAgo(49),
};

const SEEDING: SearchDetailResponseDto = {
  ...DETAIL,
  state: 'seeding',
  ending: null,
  spent: { amount: 1.2, currency: 'USD' },
  iterationsRun: 0,
  proposed: 0,
  best: null,
  endedAt: null,
  iterations: [],
  seed: {
    ...SEED,
    replayState: 'running',
    searchScore: null,
    heldOutScore: null,
    costPerRun: null,
    searchScored: 0,
  },
  candidates: [],
  frontier: [SEED.candidateId],
};

const withSource = (client: QueryClient) => {
  const lines = client.getQueryData<LineResponseDto[]>(
    lineKeys.forTeam(TEAM_ID),
  );

  client.setQueryData(
    lineKeys.forTeam(TEAM_ID),
    lines?.map((line) =>
      line.id === LINE_ID
        ? {
            ...line,
            source: { repository: 'acme/config', path: 'lines/default.tf' },
            replayCheck: { mostRegressions: 0, ceiling: 10, currency: 'USD' },
          }
        : line,
    ),
  );
};

export const seedStationSearches = (client: QueryClient) => {
  seedStationReplays(client);
  withSource(client);
  client.setQueryData(replaySetKeys.forStation(STATION_ID), [SET, SMALL_SET]);
  client.setQueryData(searchKeys.forStation(STATION_ID), [SUMMARY, EARLIER]);
};

export const seedStationSearchesAwaiting = (client: QueryClient) => {
  seedStation(client);
  client.setQueryData(replaySetKeys.forStation(STATION_ID), [SET, SMALL_SET]);
};

export const seedStationWithoutSearches = (client: QueryClient) => {
  seedStationReplays(client);
  client.setQueryData(replaySetKeys.forStation(STATION_ID), [SET, SMALL_SET]);
  client.setQueryData(searchKeys.forStation(STATION_ID), []);
};

export const failStationSearches = (client: QueryClient) => {
  seedStationReplays(client);
  failQuery(client, searchKeys.forStation(STATION_ID));
};

export const refuseStationSearches = (client: QueryClient) => {
  seedStationReplays(client);
  failQuery(client, searchKeys.forStation(STATION_ID), NOT_ON_TEAM);
};

const seedSearchAround = (client: QueryClient) => {
  seedStationPlace(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [SET, SMALL_SET]);
  client.setQueryData(searchKeys.forStation(STATION_ID), [SUMMARY, EARLIER]);
};

export const seedSearchAwaiting = seedSearchAround;

export const seedSearch = (client: QueryClient) => {
  seedSearchAround(client);
  client.setQueryData(searchKeys.detail(SEARCH_ID), DETAIL);
};

export const seedSeedingSearch = (client: QueryClient) => {
  seedSearchAround(client);
  client.setQueryData(searchKeys.detail(SEARCH_ID), SEEDING);
};

export const failSearch = (client: QueryClient) => {
  seedSearchAround(client);
  failQuery(client, searchKeys.detail(SEARCH_ID));
};

const SEARCH_RUN: SearchRunResponseDto = {
  id: SEARCH_RUN_ID,
  briefing: [
    '# Searching for a better station',
    '',
    'You are improving the Implementation station of the default line. Propose up to 2 candidate configs this iteration; each is replayed on the searched tasks.',
    '',
    '## What you may change',
    '',
    '- agent_prompt, model, effort, skills',
    '',
    '## How to go about it',
    '',
    '1. Read how earlier candidates did: `spotlight history --station implementation --line default`',
    '2. Propose: `spotlight candidate --name … --hypothesis …`',
    '3. End the run once you have proposed.',
  ].join('\n'),
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: hoursAgo(5.5),
  updatedAt: hoursAgo(5.2),
  harness: 'claude-code',
  image: null,
  station: {
    id: STATION_ID,
    name: 'Implementation',
    color: '#5c66d9',
    position: 2,
    count: 4,
  },
  review: null,
  searchId: SEARCH_ID,
  iteration: 1,
  agent: AGENT,
  failure: null,
  endedAt: hoursAgo(5.2),
  spent: { spentCosts: [{ amount: 0.62, currency: 'USD' }], unpricedCalls: 0 },
  spend: {
    cost: 0.62,
    currency: 'USD',
    inputTokens: 2_400,
    outputTokens: 9_800,
    cacheReadTokens: 410_000,
    cacheWriteTokens: 22_000,
  },
  journals: [
    {
      runId: SEARCH_RUN_ID,
      attempt: 1,
      ms: 1_080_000,
      spans: [],
      marks: {
        startedAt: hoursAgo(5.5),
        readyAt: null,
        spokeFrom: null,
        spokeTo: null,
        endedAt: hoursAgo(5.2),
      },
      spent: { used: 61_000, size: 200_000, cost: null, currency: null },
      steps: [
        {
          kind: 'thought',
          status: null,
          tool: null,
          text: 'Three of five searched tasks failed after editing code before reading its tests.',
          detail: null,
          ms: 1_200,
          startedAt: hoursAgo(5.45),
          locations: [],
          given: null,
          returned: null,
          change: null,
        },
        {
          kind: 'tool',
          status: 'completed',
          tool: 'execute',
          text: 'spotlight candidate --name tests-first --hypothesis "…" station.json',
          detail: 'Proposed tests-first; replaying it on 5 tasks',
          ms: 2_100,
          startedAt: hoursAgo(5.3),
          locations: [],
          given: null,
          returned: null,
          change: null,
        },
      ],
    },
  ],
};

const seedSearchRunAround = (client: QueryClient) => {
  seedStationPlace(client);
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), []);
  client.setQueryData(searchKeys.forStation(STATION_ID), [SUMMARY, EARLIER]);
  failQuery(client, replayRunKeys.forRun(SEARCH_RUN_ID), NOT_ON_TEAM);
  seedNoRunMemories(client, TEAM_ID, SEARCH_RUN_ID);
};

export const seedSearchRunAwaiting = seedSearchRunAround;

export const seedSearchRun = (client: QueryClient) => {
  seedSearchRunAround(client);
  client.setQueryData(searchRunKeys.forRun(SEARCH_RUN_ID), SEARCH_RUN);
};

export const seedEmptySearchRun = (client: QueryClient) => {
  seedSearchRunAround(client);
  client.setQueryData(searchRunKeys.forRun(SEARCH_RUN_ID), {
    ...SEARCH_RUN,
    state: 'failed',
    exitCode: 1,
    failure: 'runner-lost',
    spent: { spentCosts: [], unpricedCalls: 0 },
    spend: null,
    journals: [],
  } satisfies SearchRunResponseDto);
};

export const failSearchRun = (client: QueryClient) => {
  seedSearchRunAround(client);
  failQuery(client, searchRunKeys.forRun(SEARCH_RUN_ID));
};
