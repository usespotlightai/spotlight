export const CANDIDATE_KINDS = [
  'live',
  'proposed',
  'searched',
  'planned',
  'sanity',
] as const;

export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

export const ORIGIN_KINDS = [
  'searched',
  'proposed',
] as const satisfies readonly CandidateKind[];

export type OriginKind = (typeof ORIGIN_KINDS)[number];

export const isOriginKind = (kind: CandidateKind): kind is OriginKind =>
  (ORIGIN_KINDS as readonly CandidateKind[]).includes(kind);
