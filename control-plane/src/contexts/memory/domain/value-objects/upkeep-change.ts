export const UPKEEP_CHANGES = ['retire', 'merge'] as const;

export type UpkeepChange = (typeof UPKEEP_CHANGES)[number];

export const UPKEEP_FINDINGS = [
  'path-gone',
  'repository-gone',
  'unused',
  'wrong',
  'overlap',
] as const;

export type UpkeepFinding = (typeof UPKEEP_FINDINGS)[number];

export const UPKEEP_PROPOSAL_STATES = [
  'pending',
  'approved',
  'rejected',
  'lapsed',
] as const;

export type UpkeepProposalState = (typeof UPKEEP_PROPOSAL_STATES)[number];
