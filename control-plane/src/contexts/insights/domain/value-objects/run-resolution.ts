export const RUN_RESOLUTIONS = [
  'accepted',
  'sent-back',
  'moved-on',
  'failed',
  'other',
] as const;

export type RunResolution = (typeof RUN_RESOLUTIONS)[number];
