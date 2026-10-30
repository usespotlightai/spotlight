import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Claimant } from '@work/domain/repositories/run.repository';

export interface WaitingRun {
  readonly run: Run;
  readonly queuedAt: Date;
}

const fits = (run: Run, by: Pick<Claimant, 'harnesses' | 'offer'>): boolean =>
  by.harnesses.some((each) => each.equals(run.harness)) &&
  run.placement.matches(by.offer);

const takeable = (run: Run, by: Claimant, now: Date): boolean =>
  run.state === 'queued' &&
  run.claimableAt(now) &&
  run.workspaceId.equals(by.workspaceId) &&
  (by.claims === 'reserved'
    ? run.isReservedAt(now) && (run.reservation?.isFor(by.runner) ?? false)
    : !run.isReservedAt(now) || (run.reservation?.isFor(by.runner) ?? false)) &&
  fits(run, by);

const sooner = (a: WaitingRun, b: WaitingRun): number =>
  b.run.priority.value - a.run.priority.value ||
  a.queuedAt.getTime() - b.queuedAt.getTime();

export const ClaimOrder = {
  fits,

  takeable,

  next(waiting: readonly WaitingRun[], by: Claimant, now: Date): Run | null {
    return (
      waiting.filter((each) => takeable(each.run, by, now)).sort(sooner)[0]
        ?.run ?? null
    );
  },
};
