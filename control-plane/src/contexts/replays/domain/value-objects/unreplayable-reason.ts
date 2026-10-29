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
  'dispatch-failed',
] as const;

export type UnreplayableReason = (typeof UNREPLAYABLE_REASONS)[number];

export const isUnreplayableReason = (
  code: string,
): code is UnreplayableReason =>
  (UNREPLAYABLE_REASONS as readonly string[]).includes(code);
