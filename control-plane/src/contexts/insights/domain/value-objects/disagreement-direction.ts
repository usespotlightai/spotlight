export const DISAGREEMENT_DIRECTIONS = [
  'judge-failed',
  'judge-passed',
] as const;

export type DisagreementDirection = (typeof DISAGREEMENT_DIRECTIONS)[number];

export const directionOf = (judgePasses: boolean): DisagreementDirection =>
  judgePasses ? 'judge-passed' : 'judge-failed';
