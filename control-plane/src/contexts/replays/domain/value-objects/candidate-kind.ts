export const CANDIDATE_KINDS = ['live', 'proposed'] as const;

export type CandidateKind = (typeof CANDIDATE_KINDS)[number];
