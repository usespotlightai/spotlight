export const CANDIDATE_KINDS = [
  'live',
  'proposed',
  'searched',
  'planned',
] as const;

export type CandidateKind = (typeof CANDIDATE_KINDS)[number];
