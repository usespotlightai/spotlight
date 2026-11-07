export const CANDIDATE_KINDS = [
  'live',
  'searched',
  'planned',
  'oracle',
] as const;

export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

export const isLiveKind = (kind: CandidateKind): boolean => kind === 'live';

export const isOracleKind = (kind: CandidateKind): boolean => kind === 'oracle';
