const HUMAN_ACTION_KINDS = [
  'started',
  'parked',
  'accepted',
  'answered',
  'approved',
  'dismissed',
  'sent-back',
  'taken-over',
] as const;

export type HumanActionKind = (typeof HUMAN_ACTION_KINDS)[number];
