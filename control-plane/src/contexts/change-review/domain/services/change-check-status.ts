import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackState } from '@change-review/domain/value-objects/stack-progress.vo';

export const CHANGE_CHECK_STATUSES = [
  'generating',
  'not-generated',
  'unchecked',
  'checking',
  'passed',
  'failed',
  'skipped',
] as const;

export type ChangeCheckStatus = (typeof CHANGE_CHECK_STATUSES)[number];

export interface CheckedStackState {
  readonly state: ChangeStackState;
  readonly requestsCheck: boolean;
}

export const changeCheckStatusOf = (
  stack: CheckedStackState,
  check: StackCheck | null,
  now: Date,
): ChangeCheckStatus => {
  if (stack.state === 'generating') {
    return 'generating';
  }
  if (stack.state === 'failed') {
    return 'not-generated';
  }
  if (!stack.requestsCheck) {
    return 'unchecked';
  }
  if (!check || check.redrafting) {
    return 'checking';
  }

  switch (check.statusAt(now)) {
    case 'waiting':
      return 'checking';
    case 'skipped':
      return 'skipped';
    default:
      return check.wholeFailed ? 'failed' : 'passed';
  }
};
