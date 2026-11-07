export const TRIAL_FOLLOW_UPS = ['accepted', 'sent-back'] as const;

export type TrialFollowUp = (typeof TRIAL_FOLLOW_UPS)[number];
