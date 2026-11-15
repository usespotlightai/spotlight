export const DISAGREEMENT_STATES = ['open', 'answered', 'withdrawn'] as const;

export type DisagreementState = (typeof DISAGREEMENT_STATES)[number];
