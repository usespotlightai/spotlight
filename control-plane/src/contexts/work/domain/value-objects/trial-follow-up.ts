export const TRIAL_FOLLOW_UPS = ['accepted', 'sent-back'] as const;

export type TrialFollowUp = (typeof TRIAL_FOLLOW_UPS)[number];

export const isTrialFollowUp = (value: string): value is TrialFollowUp =>
  (TRIAL_FOLLOW_UPS as readonly string[]).includes(value);
