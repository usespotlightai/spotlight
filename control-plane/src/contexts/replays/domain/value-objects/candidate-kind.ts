export const CANDIDATE_KINDS = [
  'live',
  'proposed',
  'searched',
  'planned',
  'sanity',
] as const;

export type CandidateKind = (typeof CANDIDATE_KINDS)[number];
