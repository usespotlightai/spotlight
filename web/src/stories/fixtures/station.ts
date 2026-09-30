import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { stationOutcomeKeys } from '@/hooks/api/useStationOutcomes';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  LineResponseDto,
  RepositoryResponseDto,
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
        merged: 2,
        cost: { amount: 2.71, currency: 'USD' },
        medianMs: 312_000,
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
        merged: 0,
        cost: { amount: 1.93, currency: 'USD' },
        medianMs: 541_000,
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

const seedAround = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), REPOSITORIES);
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

export const failStation = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, lineKeys.forTeam(TEAM_ID));
};
