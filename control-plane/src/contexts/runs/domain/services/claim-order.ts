import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type {
  Claimant,
  SandboxRouting,
} from '@runs/domain/value-objects/claimant';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export interface ClaimCursor {
  readonly priority: number;
  readonly createdAt: Date;
  readonly id: string;
}

export interface QueuedRuns {
  readonly waiting: readonly Run[];
  readonly leasedRequesters: readonly RunRequester[];
}

export interface ReadyWarm {
  readonly line: LineId;
  readonly fingerprint: WarmFingerprint;
}

const sameWarm = (a: ReadyWarm, b: ReadyWarm): boolean =>
  a.line.equals(b.line) && a.fingerprint.equals(b.fingerprint);

const fits = (run: Run, by: Pick<Claimant, 'harnesses' | 'offer'>): boolean =>
  by.harnesses.some((each) => each.equals(run.harness)) &&
  run.placement.matches(by.offer);

const WARM_WAIT_MS = 60_000;

const hasKey = (
  key: WorkingCopyKey,
  keys: readonly WorkingCopyKey[],
): boolean => keys.some((each) => each.equals(key));

const startsFresh = (
  run: Run,
  warm: ReadyWarm,
  archived: readonly WorkingCopyKey[],
): boolean => {
  const key = run.workingCopyKey;

  return (
    (run.line?.equals(warm.line) ?? false) &&
    (run.lineFingerprint?.equals(warm.fingerprint) ?? false) &&
    key !== null &&
    run.restore === null &&
    !hasKey(key, archived)
  );
};

const routed = (
  run: Run,
  routing: SandboxRouting | undefined,
  archived: readonly WorkingCopyKey[],
): boolean => {
  const key = run.workingCopyKey?.value ?? '';

  if (!routing) {
    return true;
  }

  if ('into' in routing) {
    return key === routing.into.value;
  }

  const avoided = routing.avoiding.some((each) => each.value === key);

  return 'firstOfLine' in routing
    ? !avoided &&
        startsFresh(
          run,
          { line: routing.firstOfLine, fingerprint: routing.fingerprint },
          archived,
        )
    : !avoided;
};

const takeable = (
  run: Run,
  by: Claimant,
  now: Date,
  archived: readonly WorkingCopyKey[],
): boolean =>
  run.state === 'queued' &&
  run.claimableAt(now) &&
  run.workspaceId.equals(by.workspaceId) &&
  (by.claims === 'reserved'
    ? run.isReservedAt(now) && (run.reservation?.isFor(by.runner) ?? false)
    : !run.isReservedAt(now) || (run.reservation?.isFor(by.runner) ?? false)) &&
  fits(run, by) &&
  routed(run, by.sandbox, archived);

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

  needsArchivedKeys(by: Claimant): boolean {
    return by.sandbox !== undefined && 'firstOfLine' in by.sandbox;
  },

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

  reservedForWarm(input: {
    ready: readonly ReadyWarm[];
    firstRuns: QueuedRuns;
    archived: readonly WorkingCopyKey[];
    avoiding: readonly WorkingCopyKey[];
    now: Date;
  }): WorkingCopyKey[] {
    const since = ClaimOrder.warmWaitSince(input.now);
    const reserved: WorkingCopyKey[] = [];
    const kinds = input.ready.filter(
      (each, at) =>
        input.ready.findIndex((other) => sameWarm(each, other)) === at,
    );

    for (const warm of kinds) {
      const count = input.ready.filter((each) => sameWarm(each, warm)).length;
      reserved.push(
        ...input.firstRuns.waiting
          .filter(
            (run) =>
              run.state === 'queued' &&
              run.queuedAt >= since &&
              startsFresh(run, warm, input.archived),
          )
          .sort(sooner)
          .flatMap((run) => (run.workingCopyKey ? [run.workingCopyKey] : []))
          .filter(
            (key) => !hasKey(key, input.avoiding) && !hasKey(key, reserved),
          )
          .slice(0, count),
      );
    }

    return reserved;
  },

  provisionable(queued: QueuedRuns, now: Date, withEgress: boolean): Run[] {
    return queued.waiting.filter(
      (each) =>
        each.provisionableAt(now, withEgress) &&
        !waitsForItsRequester(each, queued.leasedRequesters),
    );
  },

  inOrder(
    candidates: QueuedRuns,
    by: Claimant,
    now: Date,
    archived: readonly WorkingCopyKey[],
  ): Run[] {
    return candidates.waiting
      .filter(
        (each) =>
          takeable(each, by, now, archived) &&
          !waitsForItsRequester(each, candidates.leasedRequesters),
      )
      .sort(sooner);
  },
};
