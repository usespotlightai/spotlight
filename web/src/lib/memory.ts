import type {
  LineResponseDto,
  ProposedMemoryResponseDto,
  RunMemoriesResponseDto,
  RunProposalResponseDto,
  TeamMemoryResponseDto,
  WriteMemoryRequestDto,
} from '@/lib/api';
import {
  type DecisionStanding,
  WAITING_FOR_APPROVAL,
} from '@/lib/decision-standing';
import { teamSectionPath } from '@/lib/team';

export type ProposedMemory = ProposedMemoryResponseDto;

export type TeamMemory = TeamMemoryResponseDto;

export type RunMemories = RunMemoriesResponseDto;

export type RunProposal = RunProposalResponseDto;

export const FOCUS_PARAM = 'memory';

export const memoryPath = (
  slug: string,
  teamId: string,
  memoryId: string,
): string =>
  `${teamSectionPath(slug, teamId, 'memory')}?${FOCUS_PARAM}=${encodeURIComponent(memoryId)}`;

export const usedBy = (runs: number): string =>
  runs === 0
    ? 'No run has used it yet'
    : `Used by ${runs} ${runs === 1 ? 'run' : 'runs'}`;

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

export const MOST_MEMORY_BODY = 1_000;

export const MOST_RETIRE_REASON = 500;

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
    "Why something was done the way it was, where the reason isn't written down.",
  'rejected-approach':
    'An approach that was tried or weighed and set aside, and why, so nobody tries it again.',
  failure:
    'Something that failed and what it failed on, such as a flaky test or a broken command.',
  environment:
    'A quirk of where the work runs, such as a service that must be started first.',
  preference: 'How someone on the team wants things done.',
  correction:
    'Someone telling the agent it was wrong, and what is right instead.',
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

const PROPOSAL_STANDINGS: Record<ProposedMemory['state'], DecisionStanding> = {
  proposed: 'waiting',
  approved: 'approved',
  rejected: 'declined',
};

export const proposalStandingOf = (memory: ProposedMemory): DecisionStanding =>
  PROPOSAL_STANDINGS[memory.state];

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

export const STANDING_VIEWS = [
  { id: 'stands', label: 'Standing' },
  { id: 'retired', label: 'Retired' },
] as const;

type MemoryStanding = (typeof STANDING_VIEWS)[number]['id'];

export type MemoryFilter = {
  readonly standing: MemoryStanding;
  readonly kind: string | null;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly path: string | null;
};

const FILTERED = ['kind', 'lineId', 'stationId', 'repository', 'path'] as const;

export const filterOf = (params: URLSearchParams): MemoryFilter => ({
  standing: params.get('standing') === 'retired' ? 'retired' : 'stands',
  kind: params.get('kind'),
  lineId: params.get('lineId'),
  stationId: params.get('stationId'),
  repository: params.get('repository'),
  path: params.get('path'),
});

export const paramsOf = (filter: MemoryFilter): Record<string, string> =>
  Object.fromEntries([
    ...(filter.standing === 'retired'
      ? [['standing', 'retired'] as const]
      : []),
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
  standing: filter.standing,
  kind: null,
  lineId: null,
  stationId: null,
  repository: null,
  path: null,
});

export const SOURCE_LABELS: Record<TeamMemory['source'], string> = {
  person: 'From a person',
  run: 'From a run',
  outside: 'From outside the team',
};

export const placeOf = (
  memory: Pick<TeamMemory, 'lineId' | 'stationId' | 'repository' | 'paths'>,
  lines: readonly LineResponseDto[],
): string => {
  const line = lines.find((each) => each.id === memory.lineId);
  const station = line?.stations.find((each) => each.id === memory.stationId);
  const where = station
    ? `${line?.name} › ${station.name}`
    : line
      ? line.name
      : memory.lineId
        ? 'A line that is gone'
        : 'The whole team';

  if (!memory.repository) {
    return where;
  }

  return memory.paths.length > 0
    ? `${where} · ${memory.repository}: ${memory.paths.join(', ')}`
    : `${where} · ${memory.repository}`;
};

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
    return proposal.standing === 'retired' ? 'Kept, since retired' : 'Kept';
  }

  return 'Waiting for you';
};
