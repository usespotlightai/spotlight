import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';

export type ReviewWorkItem =
  | { readonly kind: 'diff'; readonly diff: PushDiff }
  | { readonly kind: 'check'; readonly check: StackCheck };

export const reviewWorkOrder = (
  diffs: readonly PushDiff[],
  checks: readonly StackCheck[],
): ReviewWorkItem[] => [
  ...diffs.map((diff) => ({ kind: 'diff' as const, diff })),
  ...checks.map((check) => ({ kind: 'check' as const, check })),
];
