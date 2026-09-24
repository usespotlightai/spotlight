import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Claimant } from '@work/domain/repositories/run.repository';

export interface WaitingRun {
  readonly run: Run;
  readonly queuedAt: Date;
}

const takeable = (run: Run, by: Claimant): boolean =>
  run.state === 'queued' &&
  run.workspaceId.equals(by.workspaceId) &&
  by.harnesses.some((each) => each.equals(run.harness)) &&
  (run.targetRunner === null || run.targetRunner.equals(by.runner)) &&
  run.placement.admits(by.terms);

const sooner = (a: WaitingRun, b: WaitingRun): number =>
  b.run.priority.value - a.run.priority.value ||
  a.queuedAt.getTime() - b.queuedAt.getTime();

export const ClaimOrder = {
  takeable,

  next(waiting: readonly WaitingRun[], by: Claimant): Run | null {
    return (
      waiting.filter((each) => takeable(each.run, by)).sort(sooner)[0]?.run ??
      null
    );
  },
};
