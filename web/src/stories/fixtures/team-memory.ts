import type { QueryClient } from '@tanstack/react-query';
import { lineKeys } from '@/hooks/api/useLines';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import type {
  LineResponseDto,
  StationResponseDto,
  TeamMemoryDetailResponseDto,
  TeamMemoryResponseDto,
} from '@/lib/api';
import {
  FOCUS_PARAM,
  filterOf,
  type MemoryKind,
  WRITE_PARAM,
} from '@/lib/memory';
import { failQuery } from '@/stories/failQuery';
import { MAYA_IMAGE } from '@/stories/fixtures/avatars';
import { seedTeam, TEAM_ID } from '@/stories/fixtures/team-section';

export { SLUG, TEAM_ID } from '@/stories/fixtures/team-section';

const station = (
  over: Pick<StationResponseDto, 'id' | 'name' | 'position' | 'kind'>,
): StationResponseDto => ({
  key: over.id,
  color: '#5c66d9',
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  judge: null,
  alerts: [],
  skills: [],
  ...over,
});

const LINES: LineResponseDto[] = [
  {
    id: 'line_delivery',
    key: 'delivery',
    name: 'Delivery',
    stations: [
      station({
        id: 'station_backlog',
        name: 'Backlog',
        position: 0,
        kind: 'backlog',
      }),
      station({
        id: 'station_implementation',
        name: 'Implementation',
        position: 1,
        kind: 'work',
      }),
      station({
        id: 'station_review',
        name: 'Code Review',
        position: 2,
        kind: 'work',
      }),
      station({
        id: 'station_done',
        name: 'Done',
        position: 3,
        kind: 'completed',
      }),
    ],
    reactions: [],
    repositories: ['acme/api', 'acme/worker'],
    source: null,
    replayCheck: null,
  },
];

const MAYA = { id: 'user_2', name: 'Maya Chen', image: MAYA_IMAGE };

const memory = (
  over: Partial<TeamMemoryResponseDto> & { id: string; body: string },
): TeamMemoryResponseDto => ({
  handle: 'M-1',
  kind: 'preference',
  source: 'person',
  standing: 'stands',
  reach: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: MAYA,
  approvedAt: '2026-09-15T11:40:00.000Z',
  supersedes: null,
  retirement: null,
  grounds: null,
  runs: 0,
  ...over,
});

const STANDING: TeamMemoryResponseDto[] = [
  memory({
    id: 'memory_billing',
    handle: 'M-41',
    kind: 'correction',
    body: 'Leave billing-retries alone while billing is being reconciled; drain webhook-retries first.',
    grounds: { taskId: 'task_retries', runId: 'run_retries_2' },
  }),
  memory({
    id: 'memory_gone',
    handle: 'M-42',
    kind: 'rationale',
    source: 'run',
    reach: 'station',
    lineId: 'line_delivery',
    stationId: 'station_implementation',
    repository: 'acme/worker',
    paths: ['src/retries/deliver.ts'],
    body: 'A 410 Gone from a webhook endpoint is permanent, so its deliveries are dropped rather than retried.',
    grounds: { taskId: 'task_retries', runId: 'run_retries_2' },
  }),
  memory({
    id: 'memory_staging',
    handle: 'M-43',
    kind: 'environment',
    reach: 'line',
    lineId: 'line_delivery',
    body: 'The staging queue worker must be restarted after every deploy, or it keeps the old retry limits.',
  }),
];

const RETIRED: TeamMemoryResponseDto[] = [
  memory({
    id: 'memory_branches',
    handle: 'M-44',
    body: 'Name branches after the person who opened the task.',
    standing: 'retired',
    retirement: {
      at: '2026-09-16T09:00:00.000Z',
      by: null,
      reason: null,
      supersededBy: 'memory_branches_ticket',
    },
  }),
  memory({
    id: 'memory_flaky',
    handle: 'M-45',
    kind: 'failure',
    body: 'The upload test flakes on the shared runner.',
    standing: 'retired',
    retirement: {
      at: '2026-09-17T10:00:00.000Z',
      by: MAYA,
      reason: 'It was fixed in the runner image.',
      supersededBy: null,
    },
  }),
];

const DETAIL: TeamMemoryDetailResponseDto = {
  ...(STANDING[1] as TeamMemoryResponseDto),
  harness: 'claude-code',
  steps: [
    {
      index: 7,
      kind: 'thought',
      text: 'Three endpoints answer 410 Gone. They will never come back, so retrying them only fills the queue again.',
    },
  ],
  notes: [],
  superseded: null,
  successor: null,
};

const seedLines = (client: QueryClient) => {
  seedTeam(client);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
};

const standingOf = (count: number): TeamMemoryResponseDto[] =>
  Array.from({ length: count }, (_, at) => {
    const base = STANDING[at % STANDING.length] as TeamMemoryResponseDto;

    return at < STANDING.length
      ? base
      : { ...base, id: `${base.id}_${at}`, handle: `M-${41 + at}` };
  });

const detailOf = (
  memory: TeamMemoryResponseDto,
): TeamMemoryDetailResponseDto =>
  memory.id === DETAIL.id
    ? DETAIL
    : {
        ...memory,
        harness: null,
        steps: [],
        notes: [],
        superseded: null,
        successor: null,
      };

export const OPENABLE = [...STANDING, ...RETIRED].map((memory) => memory.id);

export const MEMORY_PAGE_STATES = [
  'data',
  'empty',
  'loading',
  'error',
] as const;

export type MemoryPageArgs = {
  readonly state: (typeof MEMORY_PAGE_STATES)[number];
  readonly standing: 'stands' | 'retired';
  readonly kind: MemoryKind | 'any';
  readonly count: number;
  readonly opened: string;
  readonly writing: boolean;
};

const filterQueryOf = (args: MemoryPageArgs): URLSearchParams =>
  new URLSearchParams({
    ...(args.standing === 'retired' ? { standing: 'retired' } : {}),
    ...(args.kind === 'any' ? {} : { kind: args.kind }),
  });

export const memoryPageQuery = (args: MemoryPageArgs): string => {
  const query = filterQueryOf(args);

  if (args.opened !== 'none') {
    query.set(FOCUS_PARAM, args.opened);
  }
  if (args.writing) {
    query.set(WRITE_PARAM, '1');
  }

  return query.size > 0 ? `?${query}` : '';
};

export const seedMemoryPage =
  (args: MemoryPageArgs) => (client: QueryClient) => {
    seedLines(client);
    const key = teamMemoryKeys.listed(TEAM_ID, filterOf(filterQueryOf(args)));

    if (args.state === 'loading') {
      return;
    }
    if (args.state === 'error') {
      failQuery(client, key);
      return;
    }

    const listed =
      args.state === 'empty'
        ? []
        : (args.standing === 'retired'
            ? RETIRED
            : standingOf(args.count)
          ).filter(
            (memory) => args.kind === 'any' || memory.kind === args.kind,
          );

    client.setQueryData(key, listed);
    for (const memory of listed) {
      client.setQueryData(
        teamMemoryKeys.one(TEAM_ID, memory.id),
        detailOf(memory),
      );
    }
  };
