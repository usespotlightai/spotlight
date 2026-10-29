export const CANDIDATE_KINDS = [
  'live',
  'searched',
  'planned',
  'oracle',
] as const;

export type CandidateKind = (typeof CANDIDATE_KINDS)[number];
