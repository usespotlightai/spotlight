const REPLAY_REFUSALS = [
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
] as const;

export type ReplayRefusal = (typeof REPLAY_REFUSALS)[number];

export const isReplayRefusal = (value: string): value is ReplayRefusal =>
  (REPLAY_REFUSALS as readonly string[]).includes(value);

export class UnreplayableRunError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    readonly runId: string,
    readonly refusal: ReplayRefusal,
    readonly reason: string,
  ) {
    super(`Run ${runId} cannot be replayed. ${reason}`);
    this.name = 'UnreplayableRunError';
  }
}
