export const LABEL_SOURCES = [
  'accepted',
  'sent-back',
  'merged',
  'held',
] as const;

export type LabelSource = (typeof LABEL_SOURCES)[number];

export const passesOn = (from: LabelSource): boolean =>
  from === 'accepted' || from === 'merged';
