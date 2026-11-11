const REVIEW_STATES = ['approved', 'changes-requested', 'commented'] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];
