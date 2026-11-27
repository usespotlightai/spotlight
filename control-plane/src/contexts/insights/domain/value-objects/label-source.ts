export const LABEL_SOURCES = [
  'accepted',
  'sent-back',
  'merged',
  'held-as-wrong',
  'marked-right',
  'marked-wrong',
] as const;

export type LabelSource = (typeof LABEL_SOURCES)[number];

export const passesOn = (from: LabelSource): boolean =>
  from === 'accepted' || from === 'merged' || from === 'marked-right';
