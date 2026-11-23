import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Branch } from '@work/domain/value-objects/branch.vo';

interface StackedRetarget {
  readonly task: Task;
  readonly number: number;
}

export interface StackedTaskMoves {
  readonly into: Branch | null;
  readonly retargets: readonly StackedRetarget[];
  readonly moved: readonly Task[];
}

export const stackedTaskMoves = (
  parent: Task,
  closed: { readonly url: PullRequestUrl; readonly merged: boolean },
  stacked: readonly Task[],
): StackedTaskMoves => {
  const onParent = stacked.filter(
    (each) =>
      !each.id.equals(parent.id) && (each.base?.equals(parent.branch) ?? false),
  );
  const repository = closed.url.repository;
  const retargets =
    closed.merged && repository
      ? onParent.flatMap((task) =>
          task
            .openPullRequestsIn(repository)
            .flatMap((each) =>
              each.url.number === null
                ? []
                : [{ task, number: each.url.number }],
            ),
        )
      : [];

  return {
    into: parent.base,
    retargets,
    moved: parent.leavesItsBranchWhenClosed(closed.url, closed.merged)
      ? onParent
      : [],
  };
};
