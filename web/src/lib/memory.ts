import type {
  LineResponseDto,
  ProposedMemoryResponseDto,
  RunMemoriesResponseDto,
  RunProposalResponseDto,
  TeamMemoryResponseDto,
  WriteMemoryRequestDto,
} from '@/lib/api';
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

export const rememberedNothing = (memories: RunMemories): boolean =>
  memories.briefed.length === 0 &&
  memories.cut.length === 0 &&
  memories.recalled.length === 0 &&
  memories.proposed.length === 0;

export type MemoryGround = Pick<ProposedMemoryResponseDto, 'steps' | 'notes'>;

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

const REACH_LABELS: Record<ProposedMemory['reach'], string> = {
  team: 'the whole team',
  line: 'this line',
  station: 'this station',
};

export const undecided = (memory: ProposedMemory): boolean =>
  memory.state === 'proposed';

export const fromOutside = (memory: ProposedMemory): boolean =>
  memory.source === 'outside';

export const askedByAgent = (memory: ProposedMemory): boolean =>
  memory.origin === 'remembered';

const STEP_LABELS: Record<string, string> = {
  handover: 'The agent handed over',
  remember: 'The agent asked the team to remember',
};

export const stepLabel = (kind: string): string =>
  STEP_LABELS[kind] ?? `The agent ${kind}`;

export const approvableTogether = (
  memories: readonly ProposedMemory[],
): ProposedMemory[] =>
  memories.filter((each) => undecided(each) && !fromOutside(each));

export const reachOf = (memory: ProposedMemory): string => {
  const where = REACH_LABELS[memory.reach];

  if (!memory.repository) {
    return `Applies to ${where}`;
  }

  return memory.paths.length > 0
    ? `Applies to ${where}, in ${memory.paths.join(', ')} of ${memory.repository}`
    : `Applies to ${where}, in ${memory.repository}`;
};

export const decidedBy = (memory: ProposedMemory): string | null => {
  if (!memory.decision) {
    return null;
  }

  const who = memory.decision.name ?? 'Someone';

  return memory.state === 'approved'
    ? `${who} approved this.`
    : `${who} rejected this.`;
};

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

export const narrowed = (filter: MemoryFilter): boolean =>
  FILTERED.some((key) => Boolean(filter[key]));

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

export const retiredAs = (
  retirement: NonNullable<TeamMemory['retirement']>,
): string =>
  retirement.supersededBy
    ? 'Replaced by a newer memory.'
    : `Retired by ${retirement.by?.name ?? 'someone'}: ${retirement.reason ?? 'no reason given'}`;

const counted = (count: number, what: string): string | null =>
  count > 0 ? `${count} ${what}` : null;

export const rememberedSummary = (memories: RunMemories): string =>
  [
    counted(memories.briefed.length, 'briefed'),
    counted(memories.cut.length, 'cut by the cap'),
    counted(memories.recalled.length, 'recalled'),
    counted(memories.proposed.length, 'proposed'),
  ]
    .filter(Boolean)
    .join(' · ');

export const proposalStateOf = (proposal: RunProposal): string => {
  if (proposal.state === 'rejected') {
    return 'Rejected';
  }

  if (proposal.state === 'approved') {
    return proposal.standing === 'retired' ? 'Kept, since retired' : 'Kept';
  }

  return 'Waiting for a person';
};
