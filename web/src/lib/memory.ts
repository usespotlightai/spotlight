import type { ProposedMemoryResponseDto } from '@/lib/api';

export type ProposedMemory = ProposedMemoryResponseDto;

export const MOST_MEMORY_BODY = 1_000;

export const KIND_LABELS: Record<string, string> = {
  rationale: 'Rationale',
  'rejected-approach': 'Rejected approach',
  failure: 'Failure',
  environment: 'Environment',
  preference: 'Preference',
  correction: 'Correction',
};

const REACH_LABELS: Record<string, string> = {
  team: 'the whole team',
  line: 'this line',
  station: 'this station',
};

export const undecided = (memory: ProposedMemory): boolean =>
  memory.state === 'proposed';

export const fromOutside = (memory: ProposedMemory): boolean =>
  memory.source === 'outside';

export const approvableTogether = (
  memories: readonly ProposedMemory[],
): ProposedMemory[] =>
  memories.filter((each) => undecided(each) && !fromOutside(each));

export const reachOf = (memory: ProposedMemory): string => {
  const where = REACH_LABELS[memory.reach] ?? memory.reach;

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
