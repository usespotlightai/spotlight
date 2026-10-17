import type {
  LineResponseDto,
  ProposedMemoryResponseDto,
  RunMemoriesResponseDto,
  RunProposalResponseDto,
  TeamMemoryResponseDto,
  WriteMemoryRequestDto,
} from '@/lib/api';
import {
  type ApprovalStatus,
  WAITING_FOR_APPROVAL,
} from '@/lib/approval-status';
import { teamSectionPath } from '@/lib/team';

export type ProposedMemory = ProposedMemoryResponseDto;

export type TeamMemory = TeamMemoryResponseDto;

export type RunMemories = RunMemoriesResponseDto;

export type RunProposal = RunProposalResponseDto;

export const FOCUS_PARAM = 'memory';

export const WRITE_PARAM = 'write';

export const memoryPath = (
  slug: string,
  teamId: string,
  memoryId: string,
): string =>
  `${teamSectionPath(slug, teamId, 'memory')}?${FOCUS_PARAM}=${encodeURIComponent(memoryId)}`;

export const givenMemories = (memories: RunMemories): TeamMemory[] => {
  const briefed = new Set(memories.briefed.map((memory) => memory.id));

  return [
    ...memories.briefed,
    ...memories.recalled.filter((memory) => !briefed.has(memory.id)),
  ];
};

export const rememberedNothing = (memories: RunMemories): boolean =>
  givenMemories(memories).length === 0 && memories.proposed.length === 0;

export type MemoryGround = Pick<
  ProposedMemoryResponseDto,
  'steps' | 'notes' | 'harness'
>;

export type MemoryGroundNote = MemoryGround['notes'][number];

export const MAX_MEMORY_BODY = 1_000;

export const MAX_RETIRE_REASON = 500;

export const KIND_LABELS: Record<MemoryKind, string> = {
  rationale: 'Rationale',
  'rejected-approach': 'Rejected approach',
  failure: 'Failure',
  environment: 'Environment',
  preference: 'Preference',
  correction: 'Correction',
};

export const KIND_DESCRIPTIONS: Record<MemoryKind, string> = {
  rationale:
    "Why something was done a certain way. The reason isn't written down elsewhere.",
  'rejected-approach':
    'An approach set aside, and why. It stops anyone from trying it again.',
  failure:
    'Something that failed, and what it failed on. For example, a flaky test.',
  environment:
    'A quirk of where the work runs. For example, a service that must start first.',
  preference: 'How someone on the team wants things done.',
  correction: 'A person correcting the agent, and what is right instead.',
};

const REACH_LABELS: Record<ProposedMemory['reach'], string> = {
  team: 'the whole team',
  line: 'this line',
  station: 'this station',
};

export const undecided = (memory: ProposedMemory): boolean =>
  memory.state === 'proposed';

export const speakerOf = (note: MemoryGroundNote): string => {
  if (note.by === 'world') {
    return 'From another tool';
  }

  return note.author?.name ?? 'A teammate';
};

export const citesAnything = (grounds: MemoryGround): boolean =>
  grounds.steps.length + grounds.notes.length > 0;

type Scoped = Pick<ProposedMemory, 'reach' | 'repository' | 'paths'>;

export const appliesTo = (memory: Scoped): string => {
  const where = REACH_LABELS[memory.reach];

  return `${where.charAt(0).toUpperCase()}${where.slice(1)}`;
};

export const memoryFilesOf = (memory: Scoped): string | null => {
  if (!memory.repository) {
    return null;
  }

  return memory.paths.length > 0
    ? `${memory.paths.join(', ')} in ${memory.repository}`
    : memory.repository;
};

export const proposedSummary = (
  memories: readonly ProposedMemory[],
  agent = 'The agent',
): string => {
  const open = memories.filter(undecided).length;
  const proposed = `${agent} proposed ${memories.length} ${
    memories.length === 1 ? 'memory' : 'memories'
  }`;

  return open > 0
    ? `${proposed} · ${open} to review`
    : `${proposed} · all decided`;
};

export const proposalTitleOf = (memory: ProposedMemory): string => {
  if (undecided(memory)) {
    return WAITING_FOR_APPROVAL;
  }

  const outcome =
    memory.state === 'approved' ? 'Memory approved' : 'Memory rejected';
  const who = memory.decision?.name;

  return who ? `${outcome} by ${who}` : outcome;
};

const PROPOSAL_STATUSES: Record<ProposedMemory['state'], ApprovalStatus> = {
  proposed: 'waiting',
  approved: 'approved',
  rejected: 'declined',
};

export const proposalStatusOf = (memory: ProposedMemory): ApprovalStatus =>
  PROPOSAL_STATUSES[memory.state];

export type MemoryKind = WriteMemoryRequestDto['kind'];

const KINDS: readonly MemoryKind[] = [
  'rationale',
  'rejected-approach',
  'failure',
  'environment',
  'preference',
  'correction',
];

export const kindOf = (raw: string | null): MemoryKind =>
  KINDS.find((each) => each === raw) ?? 'preference';

export const KIND_OPTIONS = KINDS.map((value) => ({
  value,
  label: KIND_LABELS[value],
}));

export const STATUS_VIEWS = [
  { id: 'active', label: 'Active' },
  { id: 'retired', label: 'Retired' },
] as const;

type MemoryStatus = (typeof STATUS_VIEWS)[number]['id'];

export type MemoryFilter = {
  readonly status: MemoryStatus;
  readonly kind: string | null;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly path: string | null;
};

const FILTERED = ['kind', 'lineId', 'stationId', 'repository', 'path'] as const;

export const filterOf = (params: URLSearchParams): MemoryFilter => ({
  status: params.get('status') === 'retired' ? 'retired' : 'active',
  kind: params.get('kind'),
  lineId: params.get('lineId'),
  stationId: params.get('stationId'),
  repository: params.get('repository'),
  path: params.get('path'),
});

export const paramsOf = (filter: MemoryFilter): Record<string, string> =>
  Object.fromEntries([
    ...(filter.status === 'retired' ? [['status', 'retired'] as const] : []),
    ...FILTERED.flatMap((key) => {
      const value = filter[key];
      return value ? [[key, value] as const] : [];
    }),
  ]);

export const narrowedBy = (filter: MemoryFilter): number =>
  FILTERED.filter((key) => Boolean(filter[key])).length;

export const narrowed = (filter: MemoryFilter): boolean =>
  narrowedBy(filter) > 0;

export const unnarrowed = (filter: MemoryFilter): MemoryFilter => ({
  status: filter.status,
  kind: null,
  lineId: null,
  stationId: null,
  repository: null,
  path: null,
});

export interface RememberedCount {
  readonly what: string;
  readonly count: number;
}

export const rememberedCounts = (memories: RunMemories): RememberedCount[] =>
  [
    { what: 'Given', count: givenMemories(memories).length },
    { what: 'Proposed', count: memories.proposed.length },
  ].filter((each) => each.count > 0);

export const proposalStateOf = (proposal: RunProposal): string => {
  if (proposal.state === 'rejected') {
    return 'Rejected';
  }

  if (proposal.state === 'approved') {
    return proposal.status === 'retired' ? 'Kept, now retired' : 'Kept';
  }

  return 'Waiting for you';
};

export const SOURCE_LABELS: Record<TeamMemory['source'], string> = {
  person: 'Person',
  run: 'Run',
  outside: 'Outside the team',
};

export const memoryListPath = (
  slug: string,
  teamId: string,
  filter: MemoryFilter,
): string => {
  const query = new URLSearchParams(paramsOf(filter)).toString();
  const base = teamSectionPath(slug, teamId, 'memory');

  return query ? `${base}?${query}` : base;
};

export const memoryPathsOf = (
  memories: readonly Pick<TeamMemory, 'paths'>[],
  chosen: string | null,
): string[] =>
  [
    ...new Set([
      ...memories.flatMap((memory) => memory.paths),
      ...(chosen ? [chosen] : []),
    ]),
  ].sort();

type PlaceKind = 'team' | 'line' | 'station' | 'repository' | 'path';

export type PlaceNode = {
  readonly kind: PlaceKind;
  readonly label: string;
  readonly joinedBy: string | null;
  readonly children: readonly PlaceNode[];
};

export const placeTreeOf = (
  memory: Pick<TeamMemory, 'lineId' | 'stationId' | 'repository' | 'paths'>,
  lines: readonly LineResponseDto[],
): PlaceNode => {
  const line = lines.find((each) => each.id === memory.lineId);
  const station = line?.stations.find((each) => each.id === memory.stationId);
  const paths: PlaceNode[] = memory.paths.map((path) => ({
    kind: 'path',
    label: path,
    joinedBy: ' › ',
    children: [],
  }));
  const repository: PlaceNode[] = memory.repository
    ? [
        {
          kind: 'repository',
          label: memory.repository,
          joinedBy: ' › ',
          children: paths,
        },
      ]
    : [];
  const stations: PlaceNode[] = station
    ? [
        {
          kind: 'station',
          label: station.name,
          joinedBy: ' › ',
          children: repository,
        },
      ]
    : repository;

  if (line) {
    return {
      kind: 'line',
      label: line.name,
      joinedBy: null,
      children: stations,
    };
  }

  return {
    kind: memory.lineId ? 'line' : 'team',
    label: memory.lineId ? 'Line deleted' : 'The whole team',
    joinedBy: null,
    children: repository,
  };
};

export const workStationsOf = (line: LineResponseDto | undefined) =>
  (line?.stations ?? []).filter((each) => each.kind === 'work');

export const repositoriesOf = (
  line: LineResponseDto | undefined,
  lines: readonly LineResponseDto[],
): string[] => [
  ...new Set((line ? [line] : lines).flatMap((each) => each.repositories)),
];
