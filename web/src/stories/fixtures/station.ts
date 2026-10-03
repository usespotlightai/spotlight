import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { stationJudgeKeys } from '@/hooks/api/useStationJudge';
import { stationOutcomeKeys } from '@/hooks/api/useStationOutcomes';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  LineResponseDto,
  RepositoryResponseDto,
  StationJudgeAgreementResponseDto,
  StationOutcomesResponseDto,
  StationResponseDto,
  StationRunOutcomeResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { NOT_ON_TEAM, SLUG, TEAM_ID, WORKSPACE } from '@/stories/fixtures/team';

export const LINE_ID = 'line_default';
export const STATION_ID = 'station_implementation';

const station = (
  over: Partial<StationResponseDto> & {
    id: string;
    name: string;
    position: number;
  },
): StationResponseDto => ({
  key: over.name.toLowerCase(),
  color: '#5c66d9',
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  judge: null,
  alerts: [],
  kind: 'work',
  skills: [],
  ...over,
});

const LINES: LineResponseDto[] = [
  {
    id: LINE_ID,
    key: 'default',
    name: 'Default',
    reactions: [],
    repositories: ['acme/api', 'acme/web'],
    source: null,
    replayCheck: null,
    stations: [
      station({
        id: 'station_backlog',
        name: 'Backlog',
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      station({
        id: 'station_spec',
        name: 'Spec',
        position: 1,
        color: '#b36ae2',
      }),
      station({
        id: STATION_ID,
        name: 'Implementation',
        position: 2,
        description: 'Where a spec becomes a pull request.',
        harness: 'claude-code',
        model: 'opus',
        effort: 'high',
        agentPrompt:
          '## Role\n\nImplement the spec on the task.\n\n- Keep the change small\n- Ask when the spec is unclear',
        skills: ['our-migrations', 'grafana-dashboards'],
        judge: {
          rubric:
            '## A good run\n\n- Changes only what the spec asks for\n- Leaves the tests passing\n- Says what it could not do',
          claims: [],
          passShare: 1,
          sample: 0.2,
          trust: 0.6,
        },
        alerts: [
          {
            measure: 'sent_back_rate',
            risesBy: 0.2,
            above: null,
            fallsBy: null,
            below: null,
            over: 20,
          },
          {
            measure: 'cost_per_run',
            risesBy: null,
            above: 2,
            fallsBy: null,
            below: null,
            over: 10,
          },
          {
            measure: 'accepted_rate',
            risesBy: null,
            above: null,
            fallsBy: 0.1,
            below: null,
            over: 20,
          },
        ],
      }),
      station({
        id: 'station_completed',
        name: 'Completed',
        position: 3,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  },
];

const HARNESSES: HarnessResponseDto[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [
      { id: 'opus', name: 'Opus' },
      { id: 'sonnet', name: 'Sonnet' },
    ],
    defaultModel: 'sonnet',
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

const REPOSITORIES: RepositoryResponseDto[] = [
  { fullName: 'acme/api' },
  { fullName: 'acme/web' },
  { fullName: 'acme/docs' },
];

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const outcome = (
  over: Partial<StationRunOutcomeResponseDto> & { runId: string },
): StationRunOutcomeResponseDto => ({
  taskId: `task_${over.runId}`,
  endedAt: hoursAgo(2),
  ending: 'completed',
  failure: null,
  round: 1,
  cost: {
    ms: 312_000,
    steps: 48,
    faults: 0,
    used: 61_000,
    cost: 0.84,
    currency: 'USD',
  },
  checks: 'passed',
  next: { act: 'approved', at: hoursAgo(1) },
  handedOn: null,
  delivery: 'merged',
  ...over,
});

const OUTCOMES: StationOutcomesResponseDto = {
  stationId: STATION_ID,
  groups: [
    {
      fingerprint:
        'b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c93f2a9c1e',
      config: null,
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
          part: 'judge',
          name: 'sample',
          kind: 'changed',
          was: '0.1',
          now: '0.2',
        },
      ],
      tally: {
        runs: 3,
        failed: 0,
        stopped: 0,
        checksPassed: 3,
        checksFailed: 0,
        accepted: 2,
        sentBack: 0,
        withdrawn: 0,
        handedOn: 0,
        merged: 2,
        cost: { amount: 2.71, currency: 'USD' },
        medianMs: 312_000,
        p90Ms: 312_000,
        unpriced: 0,
        mixedCurrencies: false,
      },
      runs: [
        outcome({ runId: 'run_retries_3', endedAt: hoursAgo(0.3) }),
        outcome({
          runId: 'run_checks_2',
          round: 2,
          endedAt: hoursAgo(5),
          delivery: 'open',
          next: { act: 'closed', at: hoursAgo(4) },
        }),
        outcome({ runId: 'run_docs_1', endedAt: hoursAgo(26) }),
      ],
    },
    {
      fingerprint:
        '3f2a9c1e5b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9',
      config: null,
      changes: [],
      tally: {
        runs: 3,
        failed: 1,
        stopped: 1,
        checksPassed: 1,
        checksFailed: 1,
        accepted: 0,
        sentBack: 1,
        withdrawn: 0,
        handedOn: 0,
        merged: 0,
        cost: { amount: 1.93, currency: 'USD' },
        medianMs: 541_000,
        p90Ms: 541_000,
        unpriced: 0,
        mixedCurrencies: false,
      },
      runs: [
        outcome({
          runId: 'run_retries_2',
          endedAt: hoursAgo(50),
          checks: 'failed',
          next: { act: 'sent-back', at: hoursAgo(49) },
          delivery: 'open',
        }),
        outcome({
          runId: 'run_retries_1',
          ending: 'failed',
          failure: 'The agent stopped answering',
          endedAt: hoursAgo(74),
          next: null,
          cost: {
            ms: 541_000,
            steps: 80,
            faults: 3,
            used: 120_000,
            cost: 1.12,
            currency: 'USD',
          },
        }),
        outcome({
          runId: 'run_queue_1',
          ending: 'stopped',
          endedAt: hoursAgo(98),
          next: { act: 'parked', at: hoursAgo(97) },
        }),
      ],
    },
  ],
};

const RUBRIC =
  '9c41e2d7a6b3f0851e2c4d6a8b0f1e3d5c7a9b1d3f5e7a9c1b3d5f7e9a1c3b5d';

const EARLIER_RUBRIC =
  '41d7a0c8e2f6b3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3e5f7b9d1a3c5e7f9b1d3';

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const JUDGE_AGREEMENT: StationJudgeAgreementResponseDto = {
  stationId: STATION_ID,
  judge: {
    rubricVersion: RUBRIC,
    kind: 'yes-no',
    claims: [],
    passShare: 1,
    sample: 0.2,
    trust: 0.6,
  },
  standing: {
    trusted: true,
    measure: 'kappa',
    agreement: 0.71,
    pairs: 24,
    trust: 0.6,
    hiddenBecause: null,
  },
  coverage: { runs: 50, both: 24, judgeOnly: 6, peopleOnly: 14, neither: 6 },
  versions: [
    {
      rubricVersion: RUBRIC,
      kind: 'yes-no',
      current: true,
      judged: 30,
      agreement: {
        pairs: 24,
        observed: 0.875,
        kappa: 0.71,
        spearman: null,
        mae: null,
        claims: [],
      },
      confusion: {
        labels: ['no', 'yes'],
        cells: [
          [6, 2],
          [1, 15],
        ],
      },
      trend: [
        { day: daysAgo(6), judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
        { day: daysAgo(5), judged: 6, judge: 0.67, labelled: 5, people: 0.6 },
        { day: daysAgo(3), judged: 5, judge: 0.8, labelled: 4, people: 0.75 },
        { day: daysAgo(2), judged: 8, judge: 0.63, labelled: 7, people: 0.71 },
        { day: daysAgo(0), judged: 7, judge: 0.71, labelled: 5, people: 0.8 },
      ],
      firstAt: `${daysAgo(6)}T09:00:00.000Z`,
      lastAt: `${daysAgo(0)}T09:00:00.000Z`,
    },
    {
      rubricVersion: EARLIER_RUBRIC,
      kind: 'number',
      current: false,
      judged: 12,
      agreement: {
        pairs: 9,
        observed: 0.33,
        kappa: null,
        spearman: 0.42,
        mae: 1.1,
        claims: [],
      },
      confusion: {
        labels: ['1', '2', '3', '4', '5'],
        cells: [
          [1, 0, 0, 0, 0],
          [0, 1, 1, 0, 0],
          [0, 1, 0, 1, 0],
          [0, 0, 1, 1, 1],
          [0, 0, 0, 1, 0],
        ],
      },
      trend: [
        { day: daysAgo(12), judged: 5, judge: null, labelled: 4, people: 3 },
        { day: daysAgo(9), judged: 7, judge: null, labelled: 5, people: 3.6 },
      ],
      firstAt: `${daysAgo(12)}T09:00:00.000Z`,
      lastAt: `${daysAgo(9)}T09:00:00.000Z`,
    },
  ],
};

export const seedStationPlace = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), REPOSITORIES);
};

const seedJudgeAround = (client: QueryClient) => {
  seedStationPlace(client);
  client.setQueryData(stationOutcomeKeys.forStation(STATION_ID), OUTCOMES);
};

export const seedStationJudgeAwaiting = seedJudgeAround;

export const seedStationJudgeEmpty = (client: QueryClient) => {
  seedJudgeAround(client);
  client.setQueryData(stationJudgeKeys.forStation(STATION_ID), {
    ...JUDGE_AGREEMENT,
    standing: {
      ...JUDGE_AGREEMENT.standing,
      trusted: false,
      agreement: null,
      pairs: 0,
      hiddenBecause: 'too-few-pairs',
    },
    coverage: { runs: 6, both: 0, judgeOnly: 0, peopleOnly: 4, neither: 2 },
    versions: [],
  } satisfies StationJudgeAgreementResponseDto);
};

export const seedStationJudgeHidden = (client: QueryClient) => {
  seedJudgeAround(client);
  client.setQueryData(stationJudgeKeys.forStation(STATION_ID), {
    ...JUDGE_AGREEMENT,
    standing: {
      ...JUDGE_AGREEMENT.standing,
      trusted: false,
      agreement: 0.38,
      hiddenBecause: 'below-trust',
    },
  } satisfies StationJudgeAgreementResponseDto);
};

export const failStationJudge = (client: QueryClient) => {
  seedJudgeAround(client);
  failQuery(client, stationJudgeKeys.forStation(STATION_ID));
};

export const refuseStationJudge = (client: QueryClient) => {
  seedJudgeAround(client);
  failQuery(client, stationJudgeKeys.forStation(STATION_ID), NOT_ON_TEAM);
};

const seedAround = (client: QueryClient) => {
  seedStationPlace(client);
  client.setQueryData(stationJudgeKeys.forStation(STATION_ID), JUDGE_AGREEMENT);
};

export const seedStation = (client: QueryClient) => {
  seedAround(client);
  client.setQueryData(stationOutcomeKeys.forStation(STATION_ID), OUTCOMES);
};

export const seedStationAwaitingOutcomes = seedAround;

export const seedStationWithoutRuns = (client: QueryClient) => {
  seedAround(client);
  client.setQueryData(stationOutcomeKeys.forStation(STATION_ID), {
    stationId: STATION_ID,
    groups: [],
  } satisfies StationOutcomesResponseDto);
};

export const failStationOutcomes = (client: QueryClient) => {
  seedAround(client);
  failQuery(client, stationOutcomeKeys.forStation(STATION_ID));
};

export const refuseStationOutcomes = (client: QueryClient) => {
  seedAround(client);
  failQuery(client, stationOutcomeKeys.forStation(STATION_ID), NOT_ON_TEAM);
};

const STATION_CLAIMS = [
  'Changes only what the spec asks for',
  'Leaves the tests passing',
  'Says what it could not do',
];

const CLAIMS_LINES: LineResponseDto[] = LINES.map((line) => ({
  ...line,
  stations: line.stations.map((each) =>
    each.id === STATION_ID && each.judge
      ? {
          ...each,
          judge: {
            ...each.judge,
            rubric: null,
            claims: STATION_CLAIMS,
            passShare: 0.6,
          },
        }
      : each,
  ),
}));

const CLAIMS_AGREEMENT: StationJudgeAgreementResponseDto = {
  ...JUDGE_AGREEMENT,
  judge: {
    rubricVersion: RUBRIC,
    kind: 'claims',
    claims: STATION_CLAIMS,
    passShare: 0.6,
    sample: 0.2,
    trust: 0.6,
  },
  versions: JUDGE_AGREEMENT.versions.map((version) =>
    version.current
      ? {
          ...version,
          kind: 'claims',
          agreement: {
            ...version.agreement,
            observed: 0.82,
            kappa: 0.64,
            claims: [
              { index: 0, pairs: 24, observed: 0.92, kappa: 0.81 },
              { index: 1, pairs: 24, observed: 0.88, kappa: 0.72 },
              { index: 2, pairs: 20, observed: 0.65, kappa: 0.31 },
            ],
          },
          confusion: {
            labels: ['not met', 'met'],
            cells: [
              [14, 6],
              [7, 41],
            ],
          },
        }
      : version,
  ),
};

export const seedStationClaimsJudge = (client: QueryClient) => {
  seedStation(client);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), CLAIMS_LINES);
  client.setQueryData(
    stationJudgeKeys.forStation(STATION_ID),
    CLAIMS_AGREEMENT,
  );
};

export const failStation = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, lineKeys.forTeam(TEAM_ID));
};
