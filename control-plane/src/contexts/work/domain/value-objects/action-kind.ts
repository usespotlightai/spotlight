const ACTION_KINDS = [
  'started',
  'parked',
  'accepted',
  'answered',
  'approved',
  'dismissed',
  'sent-back',
  'held-as-wrong',
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];
