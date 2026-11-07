import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type {
  Claimant,
  SandboxRouting,
} from '@runs/domain/value-objects/claimant';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';

export interface QueuedRuns {
  readonly waiting: readonly Run[];
  readonly leasedRequesters: readonly RunRequester[];
}

const fits = (run: Run, by: Pick<Claimant, 'harnesses' | 'offer'>): boolean =>
  by.harnesses.some((each) => each.equals(run.harness)) &&
  run.placement.matches(by.offer);

const routed = (run: Run, routing: SandboxRouting | undefined): boolean => {
  const key = run.workspaceKey?.value ?? '';

  if (!routing) {
    return true;
  }

  return 'into' in routing
    ? key === routing.into.value
    : !routing.avoiding.some((each) => each.value === key);
};

const takeable = (run: Run, by: Claimant, now: Date): boolean =>
  run.state === 'queued' &&
  run.claimableAt(now) &&
  run.workspaceId.equals(by.workspaceId) &&
  (by.claims === 'reserved'
    ? run.isReservedAt(now) && (run.reservation?.isFor(by.runner) ?? false)
    : !run.isReservedAt(now) || (run.reservation?.isFor(by.runner) ?? false)) &&
  fits(run, by) &&
  routed(run, by.sandbox);

const waitsForItsRequester = (
  run: Run,
  leased: readonly RunRequester[],
): boolean =>
  run.policy.exclusive &&
  leased.some((each) => each.subject === run.requester.subject);

type RequestedSandboxClaim = 'skip' | 'run-of-its-key' | 'start';

const forRequested = (
  newest: Run | null,
  by: Pick<Claimant, 'harnesses' | 'offer'>,
): RequestedSandboxClaim =>
  newest && !fits(newest, by)
    ? 'skip'
    : newest?.state === 'queued'
      ? 'run-of-its-key'
      : 'start';

const queuedTime = (run: Run): number => run.queuedAt?.getTime() ?? 0;

const sooner = (a: Run, b: Run): number =>
  b.priority.value - a.priority.value ||
  queuedTime(a) - queuedTime(b) ||
  (a.id.value < b.id.value ? -1 : a.id.value > b.id.value ? 1 : 0);

export const ClaimOrder = {
  fits,

  forRequested,

  provisionable(queued: QueuedRuns, now: Date, withEgress: boolean): Run[] {
    return queued.waiting.filter(
      (each) =>
        each.provisionableAt(now, withEgress) &&
        !waitsForItsRequester(each, queued.leasedRequesters),
    );
  },

  inOrder(candidates: QueuedRuns, by: Claimant, now: Date): Run[] {
    return candidates.waiting
      .filter(
        (each) =>
          takeable(each, by, now) &&
          !waitsForItsRequester(each, candidates.leasedRequesters),
      )
      .sort(sooner);
  },
};
