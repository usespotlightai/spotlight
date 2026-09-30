const PERSON_ACTS = [
  'started',
  'parked',
  'closed',
  'answered',
  'approved',
  'refused',
  'sent-back',
] as const;

export type PersonAct = (typeof PERSON_ACTS)[number];
