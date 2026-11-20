import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { aHost } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  DRAIN_POLICY,
  GRACE_MS,
  tokenHashOf,
  WARM_AGE_MS,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { SandboxLease } from '@runners/domain/value-objects/sandbox-lease.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const START = new Date('2026-11-20T09:00:00.000Z');
const SANDBOX = 'sandbox_1';
const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');
const OTHER_HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDF');
const WORKSPACE = WorkspaceId.of('ws_1');
const OWN_KEY = 'task-a';
const GONE_RETENTION_MS = 24 * 60 * 60_000;

const WARM = WarmPart.of({
  lineId: LineId.of('line_1'),
  placement: RunnerPlacement.of(['gpu']),
  checkouts: [{ path: 'widgets', setup: 'npm ci' }],
  fingerprint: 'setup_1',
});

const OFFERS = {
  fitting: RunnerOffer.of(['gpu', 'linux']),
  other: RunnerOffer.of(['linux']),
};

const RUNS = ['run_1', 'run_2', 'run_3'] as const;
const EDITORS = ['editor_1', 'editor_2'] as const;

type RunName = (typeof RUNS)[number];
type Editor = (typeof EDITORS)[number];
type Origin = 'warm' | 'placed-warm' | 'requested' | 'for-run' | 'keyless';

interface RunFacts {
  readonly run: RunName;
  readonly key: string | null;
  readonly line: string | null;
  readonly fingerprint: string;
  readonly workspace: string;
}

type Bare =
  | 'retire'
  | 'retire-warm'
  | 'drain-for-queued'
  | 'drain-placed'
  | 'replaced'
  | 'drain-due'
  | 'sweep'
  | 'unreported'
  | 'purge';

const BARE: readonly Bare[] = [
  'retire',
  'retire-warm',
  'drain-for-queued',
  'drain-placed',
  'replaced',
  'drain-due',
  'sweep',
  'unreported',
  'purge',
];

type Step =
  | { readonly kind: 'wait'; readonly ms: number }
  | {
      readonly kind: 'heartbeat';
      readonly reports: boolean;
      readonly stopping: boolean;
    }
  | { readonly kind: 'place'; readonly offer: keyof typeof OFFERS }
  | { readonly kind: 'hold-for' | 'adopt'; readonly run: RunFacts }
  | {
      readonly kind: 'place-and-hold' | 'release' | 'retire-run';
      readonly run: RunName;
    }
  | {
      readonly kind: 'archive' | 'renew-archive' | 'release-archive';
      readonly run: RunName;
      readonly attempt: number;
    }
  | {
      readonly kind: 'editor' | 'release-editor';
      readonly connection: Editor;
    }
  | { readonly kind: 'dropped'; readonly own: boolean }
  | { readonly kind: 'stranded'; readonly known: boolean }
  | { readonly kind: Bare };

type Acting = Exclude<Step, { readonly kind: 'wait' | 'heartbeat' }>;

type BareStep = Extract<Acting, { readonly kind: Bare }>;

const isBare = (each: Acting): each is BareStep =>
  BARE.some((kind) => kind === each.kind);

const weighted = <T>(
  ...choices: readonly (readonly [number, T])[]
): fc.Arbitrary<T> =>
  fc.oneof(
    ...choices.map(([weight, value]) => ({
      weight,
      arbitrary: fc.constant(value),
    })),
  );

const runName = weighted<RunName>([3, 'run_1'], [1, 'run_2'], [1, 'run_3']);

const runFacts: fc.Arbitrary<RunFacts> = fc.record({
  run: runName,
  key: weighted<string | null>([5, OWN_KEY], [2, 'task-b'], [1, null]),
  line: weighted<string | null>([6, 'line_1'], [1, 'line_2'], [1, null]),
  fingerprint: weighted([6, 'setup_1'], [1, 'setup_2']),
  workspace: weighted([8, 'ws_1'], [1, 'ws_2']),
});

const bare = (kind: Bare): fc.Arbitrary<Step> => fc.constant({ kind });

const step: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      ms: fc.oneof(
        { weight: 6, arbitrary: fc.integer({ min: 0, max: 60_000 }) },
        { weight: 2, arbitrary: fc.integer({ min: 60_000, max: 900_000 }) },
        {
          weight: 2,
          arbitrary: fc.integer({ min: 900_000, max: 2 * GONE_RETENTION_MS }),
        },
      ),
    }),
  },
  {
    weight: 7,
    arbitrary: fc.record({
      kind: fc.constant('heartbeat' as const),
      reports: weighted([6, true], [1, false]),
      stopping: weighted([8, false], [1, true]),
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('place' as const),
      offer: weighted<keyof typeof OFFERS>([5, 'fitting'], [1, 'other']),
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('hold-for' as const),
      run: runFacts,
    }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('adopt' as const),
      run: runFacts,
    }),
  },
  ...(
    [
      ['place-and-hold', 2],
      ['release', 4],
      ['retire-run', 2],
    ] as const
  ).map(([kind, weight]) => ({
    weight,
    arbitrary: fc.record({ kind: fc.constant(kind), run: runName }),
  })),
  ...(
    [
      ['archive', 4],
      ['renew-archive', 2],
      ['release-archive', 2],
    ] as const
  ).map(([kind, weight]) => ({
    weight,
    arbitrary: fc.record({
      kind: fc.constant(kind),
      run: runName,
      attempt: weighted([4, 1], [1, 2]),
    }),
  })),
  ...(['editor', 'release-editor'] as const).map((kind) => ({
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant(kind),
      connection: fc.constantFrom(...EDITORS),
    }),
  })),
  {
    weight: 3,
    arbitrary: fc.oneof(
      fc.record({ kind: fc.constant('dropped' as const), own: fc.boolean() }),
      fc.record({
        kind: fc.constant('stranded' as const),
        known: weighted([3, true], [1, false]),
      }),
      bare('retire-warm'),
      bare('drain-placed'),
      bare('replaced'),
      bare('unreported'),
    ),
  },
  { weight: 2, arbitrary: bare('retire') },
  { weight: 2, arbitrary: bare('drain-for-queued') },
  { weight: 4, arbitrary: bare('drain-due') },
  { weight: 2, arbitrary: bare('sweep') },
  { weight: 2, arbitrary: bare('purge') },
);

const origin: fc.Arbitrary<Origin> = weighted<Origin>(
  [3, 'warm'],
  [5, 'placed-warm'],
  [2, 'requested'],
  [2, 'for-run'],
  [1, 'keyless'],
);

const hostAt = (at: Date, reports: boolean, stopping: boolean): RunnerHost =>
  aHost({
    at,
    id: HOST,
    sandboxes: reports ? [SANDBOX] : [],
    stopping,
  });

const created = (kind: Origin, host: RunnerHost): Sandbox => {
  const id = SandboxId.of(SANDBOX);

  switch (kind) {
    case 'warm':
      return Sandbox.requestWarm({
        id,
        workspaceId: WORKSPACE,
        warm: WARM,
        at: START,
      });
    case 'placed-warm':
      return created('warm', host).placeWarmOn(
        host,
        OFFERS.fitting,
        tokenHashOf(SANDBOX),
        START,
      );
    case 'requested':
      return Sandbox.request({
        id,
        workspaceId: WORKSPACE,
        key: SandboxKey.of(OWN_KEY),
        at: START,
      });
    case 'for-run':
    case 'keyless':
      return Sandbox.startForRun({
        id,
        workspaceId: WORKSPACE,
        key: kind === 'for-run' ? SandboxKey.of(OWN_KEY) : null,
        host,
        tokenHash: tokenHashOf(SANDBOX),
        runId: RunId.of('run_1'),
        at: START,
      });
  }
};

const forRun = (facts: RunFacts) => ({
  runId: RunId.of(facts.run),
  workspaceId: WorkspaceId.of(facts.workspace),
  key: facts.key === null ? null : SandboxKey.of(facts.key),
  line: facts.line === null ? null : LineId.of(facts.line),
  lineFingerprint: facts.fingerprint,
});

const placed = (
  sandbox: Sandbox,
  host: RunnerHost,
  offer: RunnerOffer,
  now: Date,
): Sandbox =>
  sandbox.warm === null
    ? sandbox.placeOn(host, tokenHashOf(SANDBOX), now)
    : sandbox.placeWarmOn(host, offer, tokenHashOf(SANDBOX), now);

const bareApplied = (
  sandbox: Sandbox,
  kind: Bare,
  host: RunnerHost,
  now: Date,
): Sandbox | 'removed' => {
  switch (kind) {
    case 'retire':
      return sandbox.retire(now);
    case 'retire-warm':
      return sandbox.retireWarm();
    case 'drain-for-queued':
      return sandbox.drainedForQueuedRun(host, now);
    case 'drain-placed':
      return sandbox.drainedWhenPlaced();
    case 'replaced':
      return sandbox.replacedForRun();
    case 'drain-due':
      return sandbox.drainedWhenDue(DRAIN_POLICY, now);
    case 'sweep':
      return sandbox.withoutExpiredLeases(now);
    case 'unreported':
      return sandbox.unreportedOn(host, now);
    case 'purge':
      return sandbox.isExpiredAt(now) ? 'removed' : sandbox;
  }
};

const applied = (
  sandbox: Sandbox,
  each: Acting,
  host: RunnerHost,
  now: Date,
): Sandbox | 'removed' => {
  if (isBare(each)) {
    return bareApplied(sandbox, each.kind, host, now);
  }

  switch (each.kind) {
    case 'place':
      return placed(sandbox, host, OFFERS[each.offer], now);
    case 'hold-for':
      return sandbox.holdRunFor(forRun(each.run), host, now);
    case 'adopt':
      return sandbox.adoptFor(forRun(each.run), host, now);
    case 'place-and-hold':
      return sandbox
        .placeOn(host, tokenHashOf(SANDBOX), now)
        .holdRun(RunId.of(each.run), now);
    case 'release':
      return sandbox.releaseRun(RunId.of(each.run), now);
    case 'retire-run':
      return sandbox.retireRun(RunId.of(each.run), now);
    case 'archive':
      return sandbox.holdArchiveOf(RunId.of(each.run), each.attempt, now);
    case 'renew-archive':
      return sandbox.renewArchiveOf(RunId.of(each.run), each.attempt, now);
    case 'release-archive':
      return sandbox.releaseArchiveOf(RunId.of(each.run), each.attempt, now);
    case 'editor':
      return sandbox.holdEditor(LeaseHolder.editor(each.connection), now);
    case 'release-editor':
      return sandbox.releaseEditor(LeaseHolder.editor(each.connection), now);
    case 'dropped':
      return sandbox.droppedBy(each.own ? HOST : OTHER_HOST, now);
    case 'stranded':
      return sandbox.strandedOn(each.known ? host : null, now);
  }
};

interface Visit {
  readonly before: Sandbox;
  readonly after: Sandbox;
  readonly removed: boolean;
  readonly step: Acting;
  readonly host: RunnerHost;
  readonly now: Date;
  readonly adoptions: number;
}

const runsIn = (sandbox: Sandbox): readonly string[] =>
  sandbox.leases.flatMap((each) => (each.isForRun ? [each.holder.id] : []));

const archivesIn = (sandbox: Sandbox): readonly SandboxLease[] =>
  sandbox.leases.filter((each) => each.isForArchive);

const newRuns = (before: Sandbox, after: Sandbox): readonly string[] =>
  runsIn(after).filter((each) => !runsIn(before).includes(each));

const walk = (kind: Origin, steps: readonly Step[]): readonly Visit[] => {
  let now = START;
  let host = hostAt(START, true, false);
  let sandbox = created(kind, host);
  let adoptions = 0;
  const visits: Visit[] = [];

  for (const each of steps) {
    if (each.kind === 'wait') {
      now = new Date(now.getTime() + each.ms);
      continue;
    }

    if (each.kind === 'heartbeat') {
      host = hostAt(now, each.reports, each.stopping);
      continue;
    }

    const before = sandbox;
    let outcome: Sandbox | 'removed' = sandbox;

    try {
      outcome = applied(sandbox, each, host, now);
    } catch (error) {
      if (!(error instanceof InconsistentStateError)) {
        throw error;
      }
    }

    const removed = outcome === 'removed';
    const after = outcome === 'removed' ? before : outcome;

    if (
      each.kind === 'adopt' &&
      before.warm !== null &&
      newRuns(before, after).length > 0
    ) {
      adoptions += 1;
    }

    visits.push({
      before,
      after,
      removed,
      step: each,
      host,
      now,
      adoptions,
    });

    if (removed) {
      break;
    }

    sandbox = after;
  }

  return visits;
};

const steps = fc.array(step, { maxLength: 60, size: 'max' });

const RUNS_PER_PROPERTY = { numRuns: 2_000 };

const lifecycle = (holds: (visit: Visit) => boolean) =>
  fc.property(origin, steps, (kind, each) => walk(kind, each).every(holds));

const storable = (sandbox: Sandbox): boolean => {
  try {
    Sandbox.rehydrate({
      id: sandbox.id,
      workspaceId: sandbox.workspaceId,
      key: sandbox.key,
      hostId: sandbox.hostId,
      source: sandbox.source,
      tokenHash: sandbox.tokenHash,
      state: sandbox.current,
      leases: sandbox.leases,
      idleSince: sandbox.idleSince,
      startedAt: sandbox.startedAt,
      goneAt: sandbox.goneAt,
      warm: sandbox.warm,
      retiring: sandbox.isRetiring,
      version: sandbox.version,
    });

    return true;
  } catch {
    return false;
  }
};

const RANK = { open: 0, draining: 1, gone: 2 } as const;

const sameKey = (before: Sandbox, after: Sandbox): boolean =>
  before.key === null || (after.key !== null && after.key.equals(before.key));

const closed = ({ before, after }: Visit): boolean =>
  before.isOpen && !after.isOpen;

const sinceMs = (from: Date | null, now: Date): number =>
  from === null ? -1 : now.getTime() - from.getTime();

const adoptedBy = (warm: WarmPart, facts: RunFacts): boolean =>
  facts.key !== null &&
  facts.line === warm.lineId.value &&
  facts.fingerprint === warm.fingerprint &&
  facts.workspace === WORKSPACE.value;

const HOLDS_A_RUN_WHILE_CLOSED_BY: readonly Acting['kind'][] = [
  'replaced',
  'drain-placed',
  'stranded',
  'unreported',
  'dropped',
];

const holdsOrEdits = (sandbox: Sandbox): boolean =>
  sandbox.leases.some((each) => each.isForRun || each.isForEditor);

const archivedAnew = ({ before, after }: Visit): readonly SandboxLease[] =>
  archivesIn(after).filter(
    (lease) =>
      !archivesIn(before).some(
        (held) =>
          held.holder.equals(lease.holder) && held.attempt === lease.attempt,
      ),
  );

describe('a sandbox under any order of host, run, editor and sweeper actions', () => {
  it('reaches only states it can store and load again', () => {
    fc.assert(
      lifecycle(({ after }) => storable(after)),
      RUNS_PER_PROPERTY,
    );
  });

  it('keeps its key once it has one, and never turns warm again', () => {
    fc.assert(
      lifecycle(
        ({ before, after }) =>
          sameKey(before, after) &&
          (before.warm !== null || after.warm === null),
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('only moves on from open to draining to gone, and takes no run once it leaves open', () => {
    fc.assert(
      lifecycle(
        ({ before, after }) =>
          RANK[after.current] >= RANK[before.current] &&
          (before.isOpen || newRuns(before, after).length === 0),
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('takes a run while warm only when that run’s key adopts it, for its own line, setup and workspace', () => {
    fc.assert(
      lifecycle((visit) => {
        const { before, after, step: each } = visit;
        const { warm } = before;

        if (warm === null || newRuns(before, after).length === 0) {
          return true;
        }

        return (
          each.kind === 'adopt' &&
          adoptedBy(warm, each.run) &&
          after.warm === null &&
          after.key?.value === each.run.key &&
          newRuns(before, after).length === 1
        );
      }),
      RUNS_PER_PROPERTY,
    );
  });

  it('stops being warm while open only when a first run adopts it', () => {
    fc.assert(
      lifecycle(
        ({ before, after }) =>
          before.warm === null ||
          after.warm !== null ||
          !after.isOpen ||
          newRuns(before, after).length === 1,
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('is held by one run at most at a time', () => {
    fc.assert(
      lifecycle(({ after }) => runsIn(after).length <= 1),
      RUNS_PER_PROPERTY,
    );
  });

  it('is adopted at most once', () => {
    fc.assert(
      lifecycle(({ adoptions }) => adoptions <= 1),
      RUNS_PER_PROPERTY,
    );
  });

  it('takes the next run of its key only while idle and ready on a host that is not stopping', () => {
    fc.assert(
      lifecycle(({ before, after, step: each, host, now }) => {
        if (each.kind !== 'hold-for' || newRuns(before, after).length === 0) {
          return true;
        }

        return (
          before.isIdle &&
          before.isReadyOn(host, now) &&
          !host.isStopping &&
          before.key?.value === each.run.key &&
          each.run.workspace === WORKSPACE.value
        );
      }),
      RUNS_PER_PROPERTY,
    );
  });

  it('holds the archive only of a run that holds it, keyed and no longer warm, one attempt per run', () => {
    fc.assert(
      lifecycle((visit) => {
        const { before, after, now } = visit;
        const archives = archivesIn(after);
        const archivedRuns = archives.map((each) => each.holder.id);

        return (
          new Set(archivedRuns).size === archivedRuns.length &&
          (archives.length === 0 ||
            (after.key !== null && after.warm === null)) &&
          archivedAnew(visit).every(
            (lease) =>
              before.holdsRun(RunId.of(lease.holder.id)) &&
              archivesIn(before).every(
                (held) =>
                  !held.holder.equals(lease.holder) || held.expiredAt(now),
              ),
          )
        );
      }),
      RUNS_PER_PROPERTY,
    );
  });

  it('gives up an archive lease only to the attempt that holds it, or once it expired', () => {
    fc.assert(
      lifecycle(({ before, after, step: each, now }) =>
        archivesIn(before).every(
          (held) =>
            archivesIn(after).some((lease) =>
              lease.holder.equals(held.holder),
            ) ||
            held.expiredAt(now) ||
            (each.kind === 'release-archive' &&
              held.holder.id === each.run &&
              held.attempt === each.attempt),
        ),
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('is closed while a run still holds it only when replaced or given up by its host', () => {
    fc.assert(
      lifecycle(
        (visit) =>
          !closed(visit) ||
          runsIn(visit.after).every(
            (each) => !visit.before.holdsRun(RunId.of(each)),
          ) ||
          HOLDS_A_RUN_WHILE_CLOSED_BY.includes(visit.step.kind),
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('drains through idleness only after the grace, or the warm age while warm', () => {
    fc.assert(
      lifecycle((visit) => {
        const { before, step: each, now } = visit;

        if (each.kind !== 'drain-due' || !closed(visit) || before.isRetiring) {
          return true;
        }

        return before.warm === null
          ? sinceMs(before.idleSince, now) >= GRACE_MS
          : sinceMs(before.startedAt, now) >= WARM_AGE_MS;
      }),
      RUNS_PER_PROPERTY,
    );
  });

  it('drains for a queued run only while warm and waiting for its first run', () => {
    fc.assert(
      lifecycle(
        (visit) =>
          visit.step.kind !== 'drain-for-queued' ||
          !closed(visit) ||
          (visit.before.warm !== null && visit.before.leases.length === 0),
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('drains at once when its work is finished and no run or editor holds it, and waits for those that do', () => {
    fc.assert(
      lifecycle(({ before, after, step: each }) => {
        if (each.kind !== 'retire' || !before.isOpen || before.key === null) {
          return true;
        }

        return holdsOrEdits(after)
          ? after.isOpen && after.isRetiring
          : !after.isOpen;
      }),
      RUNS_PER_PROPERTY,
    );
  });

  it('retires only while open and while a run or an editor still holds it', () => {
    fc.assert(
      lifecycle(
        ({ after }) =>
          !after.isRetiring || (after.isOpen && holdsOrEdits(after)),
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('stops retiring when a new run takes it', () => {
    fc.assert(
      lifecycle(
        ({ before, after }) =>
          newRuns(before, after).length === 0 || !after.isRetiring,
      ),
      RUNS_PER_PROPERTY,
    );
  });

  it('is removed only when retired before a host starts it, or a day after it is gone', () => {
    fc.assert(
      lifecycle(({ before, removed, step: each, now }) => {
        if (!removed) {
          return true;
        }

        return each.kind === 'retire-warm'
          ? before.isWarm && before.isRequested
          : before.current === 'gone' &&
              sinceMs(before.goneAt, now) >= GONE_RETENTION_MS;
      }),
      RUNS_PER_PROPERTY,
    );
  });

  it('is gone at one time only', () => {
    fc.assert(
      lifecycle(
        ({ before, after }) =>
          before.goneAt === null ||
          after.goneAt?.getTime() === before.goneAt.getTime(),
      ),
      RUNS_PER_PROPERTY,
    );
  });
});
