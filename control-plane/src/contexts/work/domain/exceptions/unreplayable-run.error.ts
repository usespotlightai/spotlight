const UNREPLAYABLE_REASONS = [
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
  'cancelled',
] as const;

export type UnreplayableReason = (typeof UNREPLAYABLE_REASONS)[number];

export const isUnreplayableReason = (
  value: string,
): value is UnreplayableReason =>
  (UNREPLAYABLE_REASONS as readonly string[]).includes(value);

export class UnreplayableRunError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    readonly runId: string,
    readonly unreplayableReason: UnreplayableReason,
    readonly reason: string,
  ) {
    super(`Run ${runId} cannot be replayed. ${reason}`);
    this.name = 'UnreplayableRunError';
  }
}
