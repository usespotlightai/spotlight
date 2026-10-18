const HUMAN_ACTION_KINDS = [
  'started',
  'parked',
  'accepted',
  'answered',
  'approved',
  'refused',
  'sent-back',
] as const;

export type HumanActionKind = (typeof HUMAN_ACTION_KINDS)[number];
