import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';

export const SEARCH_PICK_DECLINES = [
  'no-candidate',
  'no-held-out-gain',
  'not-cheaper',
  'over-regression-limit',
  'likely-overfit',
  'station-gone',
  'pull-request-open',
  'rejected-before',
] as const;

export type SearchPickDecline = (typeof SEARCH_PICK_DECLINES)[number];

export type SearchPick =
  | { readonly outcome: 'picked'; readonly candidateId: CandidateId }
  | { readonly outcome: 'declined'; readonly reason: SearchPickDecline };
