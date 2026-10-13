export const REPLAY_REFUSALS = [
  'unknown-run',
  'not-a-task-run',
  'task-gone',
  'still-running',
  'no-starting-point',
  'no-briefing',
  'archive-gone',
  'attachments-gone',
  'answer-gone',
  'repository-gone',
  'not-at-the-station',
  'candidate-unfit',
  'cannot-start',
  'unchecked',
  'forgone',
  'dispatch-failed',
] as const;

export type ReplayRefusal = (typeof REPLAY_REFUSALS)[number];

export const isReplayRefusal = (code: string): code is ReplayRefusal =>
  (REPLAY_REFUSALS as readonly string[]).includes(code);
