export const WITHDRAWAL_REASONS = [
  'verdicts-agree',
  'claims-changed',
  'label-gone',
] as const;

export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];
