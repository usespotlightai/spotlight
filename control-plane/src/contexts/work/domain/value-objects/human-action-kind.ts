export const HUMAN_ACTION_KINDS = [
  'started',
  'parked',
  'accepted',
  'answered',
  'approved',
  'dismissed',
  'sent-back',
  'held-as-wrong',
] as const;

export type HumanActionKind = (typeof HUMAN_ACTION_KINDS)[number];
