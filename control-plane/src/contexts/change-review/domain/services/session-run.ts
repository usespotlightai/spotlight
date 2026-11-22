import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { latestRunStackLike } from '@change-review/domain/services/pushed-stacks';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

/**
 * The run that hosts an assist session about a change stack (its draft, its redraft, or the grade of an answer to
 * one of its questions): the stack's own run, whose working copy made its diff. A stack that came from a push has no
 * run of its own; then the newest run of its task that made a stack of the same repository hosts it, since that run
 * holds the task's working copy. Null when no run can host the session.
 */
export const sessionRunFor = (
  stack: ChangeStack,
  taskStacks: readonly ChangeStack[],
): RunId | null =>
  stack.runId ??
  (stack.taskId
    ? (latestRunStackLike(taskStacks, stack)?.runId ?? null)
    : null);
