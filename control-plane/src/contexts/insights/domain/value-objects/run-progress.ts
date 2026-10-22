export const RUN_PROGRESSES = ['queued', 'in-progress', 'stopping'] as const;

export type RunProgress = (typeof RUN_PROGRESSES)[number];
