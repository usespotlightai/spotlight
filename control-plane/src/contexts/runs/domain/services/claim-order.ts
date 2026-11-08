import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type {
  Claimant,
  SandboxRouting,
} from '@runs/domain/value-objects/claimant';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';

export interface ClaimCursor {
  readonly priority: number;
  readonly createdAt: Date;
  readonly id: string;
}

export interface QueuedRuns {
  readonly waiting: readonly Run[];
  readonly leasedRequesters: readonly RunRequester[];
}

const fits = (run: Run, by: Pick<Claimant, 'harnesses' | 'offer'>): boolean =>
  by.harnesses.some((each) => each.equals(run.harness)) &&
  run.placement.matches(by.offer);

const WARM_WAIT_MS = 60_000;

const startsFresh = (run: Run, line: string): boolean =>
  run.tags.line === line && run.workingCopyKey !== null && run.restore === null;

const routed = (run: Run, routing: SandboxRouting | undefined): boolean => {
  const key = run.workingCopyKey?.value ?? '';

  if (!routing) {
    return true;
  }

  if ('into' in routing) {
    return key === routing.into.value;
  }

  const avoided = routing.avoiding.some((each) => each.value === key);

  return 'firstOfLine' in routing
    ? !avoided && startsFresh(run, routing.firstOfLine)
    : !avoided;
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

const sooner = (a: Run, b: Run): number =>
  b.priority.value - a.priority.value ||
  a.createdAt.getTime() - b.createdAt.getTime() ||
  (a.id.value < b.id.value ? -1 : a.id.value > b.id.value ? 1 : 0);

export const ClaimOrder = {
  fits,

  cursorAfter(page: readonly Run[]): ClaimCursor | null {
    const last = page[page.length - 1];

    return last
      ? {
          priority: last.priority.value,
          createdAt: last.createdAt,
          id: last.id.value,
        }
      : null;
  },

  forRequested,

  warmWaitSince(now: Date): Date {
    return new Date(now.getTime() - WARM_WAIT_MS);
  },

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
