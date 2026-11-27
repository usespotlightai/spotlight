import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPullPool,
  hashOf,
  HOST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  DRAIN_POLICY,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostSlotHolders } from '@runners/domain/services/host-slot-holders';
import { WarmSlots } from '@runners/domain/services/warm-slots';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { SandboxReport } from '@runners/domain/value-objects/sandbox-report.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const START = new Date('2026-11-20T09:00:00.000Z');
const CLAIM_WINDOW_MS = 60_000;
const MOST_SANDBOXES = 6;
const KEYS = ['task-a', 'task-b', 'task-c'] as const;
const LINE = LineId.of('line_1');
const SETUP = 'setup_1';

const WARM = WarmPart.of({
  lineId: LINE,
  placement: RunnerPlacement.of(['gpu']),
  checkouts: [{ path: 'widgets', setup: 'npm ci' }],
  fingerprint: SETUP,
});

type Key = (typeof KEYS)[number];

type FreshClaim =
  | { readonly kind: 'run'; readonly key: Key }
  | { readonly kind: 'warm' | 'requested' | 'waits' | 'nothing' };

type IntoClaim = 'run' | 'nothing' | 'waits' | 'misfit';

type Step =
  | { readonly kind: 'wait'; readonly ms: number }
  | {
      readonly kind: 'host';
      readonly beats: boolean;
      readonly drops: number | null;
    }
  | { readonly kind: 'request-warm' | 'runners-beat' | 'sweep' }
  | { readonly kind: 'open'; readonly key: Key }
  | { readonly kind: 'claim'; readonly outcome: FreshClaim }
  | {
      readonly kind: 'claim-into';
      readonly pick: number;
      readonly outcome: IntoClaim;
      readonly runWaits: boolean;
    }
  | { readonly kind: 'finish'; readonly pick: number; readonly retire: boolean }
  | { readonly kind: 'let-go'; readonly pick: number }
  | { readonly kind: 'dropped'; readonly pick: number }
  | { readonly kind: 'retire'; readonly key: Key };

type Acting = Exclude<Step, { readonly kind: 'wait' }>;

interface World {
  readonly capacity: number;
  readonly maxRuns: number;
  readonly pool: RunnerPool;
  readonly host: RunnerHost;
  readonly beats: boolean;
  readonly drops: number | null;
  readonly sandboxes: readonly Sandbox[];
  readonly runners: readonly Runner[];
  readonly next: number;
}

interface Admission {
  readonly admitted: boolean;
  readonly into: Sandbox | null;
  readonly fits: boolean;
  readonly takenIfAdmitted: number;
}

interface WarmStart {
  readonly started: boolean;
  readonly requested: boolean;
  readonly takenBefore: number;
}

interface WarmDrain {
  readonly runWaits: boolean;
  readonly takenBefore: number;
  readonly anyDraining: boolean;
  readonly candidates: readonly Sandbox[];
}

interface Visit {
  readonly step: Acting;
  readonly before: World;
  readonly after: World;
  readonly now: Date;
  readonly admission: Admission | null;
  readonly warmStart: WarmStart | null;
  readonly warmDrain: WarmDrain | null;
}

const weighted = <T>(
  ...choices: readonly (readonly [number, T])[]
): fc.Arbitrary<T> =>
  fc.oneof(
    ...choices.map(([weight, value]) => ({
      weight,
      arbitrary: fc.constant(value),
    })),
  );

const key = fc.constantFrom(...KEYS);

const pick = fc.nat({ max: 7 });

const freshClaim: fc.Arbitrary<FreshClaim> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({ kind: fc.constant('run' as const), key }),
  },
  {
    weight: 6,
    arbitrary: weighted<FreshClaim>(
      [4, { kind: 'warm' }],
      [1, { kind: 'requested' }],
      [1, { kind: 'waits' }],
      [1, { kind: 'nothing' }],
    ),
  },
);

const step: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      ms: fc.oneof(
        { weight: 8, arbitrary: fc.integer({ min: 0, max: 30_000 }) },
        { weight: 2, arbitrary: fc.integer({ min: 30_000, max: 400_000 }) },
        {
          weight: 1,
          arbitrary: fc.integer({ min: 400_000, max: 30 * 60 * 60_000 }),
        },
      ),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('host' as const),
      beats: weighted([3, true], [1, false]),
      drops: fc.option(pick, { freq: 6 }),
    }),
  },
  { weight: 3, arbitrary: fc.constant({ kind: 'request-warm' as const }) },
  { weight: 3, arbitrary: fc.constant({ kind: 'runners-beat' as const }) },
  { weight: 2, arbitrary: fc.constant({ kind: 'sweep' as const }) },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('open' as const), key }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('claim' as const),
      outcome: freshClaim,
    }),
  },
  {
    weight: 10,
    arbitrary: fc.record({
      kind: fc.constant('claim-into' as const),
      pick,
      outcome: weighted<IntoClaim>(
        [4, 'run'],
        [4, 'nothing'],
        [2, 'waits'],
        [1, 'misfit'],
      ),
      runWaits: weighted([3, true], [1, false]),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('finish' as const),
      pick,
      retire: fc.boolean(),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant('let-go' as const), pick }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('dropped' as const), pick }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('retire' as const), key }),
  },
);

const later = (at: Date, ms: number): Date => new Date(at.getTime() + ms);

const hostAt = (
  world: Pick<World, 'pool' | 'capacity'>,
  reported: readonly Sandbox[],
  at: Date,
): RunnerHost =>
  RunnerHost.fromHeartbeat({
    id: HOST_ID,
    workspaceId: world.pool.workspaceId,
    source: CredentialSource.ofId(world.pool.id),
    bootId: BootId.of('boot_1'),
    report: HostReport.of({
      name: 'build-box',
      release: '0.9.0',
      containerRuntime: 'docker',
      capacity: world.capacity,
      running: [],
      images: [
        {
          image: 'ghcr.io/acme/runner:main',
          isDefault: true,
          harnesses: [{ id: 'claude-code', models: [], version: '2.1.0' }],
        },
      ],
    }),
    sandboxes: SandboxReport.of({
      sandboxes: reported.map((each) => each.id.value),
      stopping: false,
    }),
    at,
  });

const begun = (capacity: number, maxRuns: number): World => {
  const pool = aPullPool({ maxRuns, labels: ['gpu', 'linux'] });

  return {
    capacity,
    maxRuns,
    pool,
    host: hostAt({ pool, capacity }, [], START),
    beats: true,
    drops: null,
    sandboxes: [],
    runners: [],
    next: 1,
  };
};

const aliveIn = (world: World, now: Date): readonly Runner[] =>
  world.runners.filter((each) => each.isAlive(now));

const enteredBy = (runners: readonly Runner[], sandbox: Sandbox): boolean =>
  runners.some((each) => each.enters?.equals(sandbox.id) ?? false);

const idleInPool = (world: World): readonly Sandbox[] =>
  world.sandboxes.filter(
    (each) =>
      each.isLive &&
      each.isIdle &&
      (each.source?.poolId?.equals(world.pool.id) ?? false),
  );

const occupancyOf = (world: World, now: Date): PoolOccupancy => {
  const alive = aliveIn(world, now);

  return PoolOccupancy.of({
    runners: alive.length,
    entered: alive.flatMap((each) => (each.enters ? [each.enters] : [])),
    idleSandboxes: idleInPool(world).map((each) => each.id),
  });
};

const idleOnHost = (world: World): readonly Sandbox[] =>
  world.sandboxes.filter(
    (each) => each.isLive && each.isIdle && each.isOn(HOST_ID),
  );

const holdersOf = (world: World, now: Date): HostSlotHolders =>
  HostSlotHolders.on(
    HOST_ID,
    aliveIn(world, now),
    idleOnHost(world).map((each) => each.id),
    now,
  );

const poolSlotsTaken = (world: World, now: Date): number => {
  const alive = aliveIn(world, now);

  return (
    alive.length +
    idleInPool(world).filter((each) => !enteredBy(alive, each)).length
  );
};

const hostSlotsTaken = (world: World, now: Date): number => {
  const idle = idleOnHost(world);
  const isIdle = (runner: Runner) =>
    idle.some((each) => runner.enters?.equals(each.id) ?? false);
  const counted = aliveIn(world, now).filter(
    (each) =>
      each.hostId?.equals(HOST_ID) === true &&
      (each.work !== null || (each.enters !== null && !isIdle(each))),
  );

  return (
    counted.length + idle.filter((each) => !enteredBy(counted, each)).length
  );
};

const replaced = (
  world: World,
  sandbox: Sandbox,
  change: (each: Sandbox) => Sandbox,
): World => ({
  ...world,
  sandboxes: world.sandboxes.map((each) =>
    each.id.equals(sandbox.id) ? change(each) : each,
  ),
});

const withRunner = (world: World, runner: Runner): World => ({
  ...world,
  runners: world.runners.map((each) =>
    each.id.equals(runner.id) ? runner : each,
  ),
});

const withoutRunner = (world: World, runner: Runner): World => ({
  ...world,
  runners: world.runners.filter((each) => !each.id.equals(runner.id)),
});

const letGo = (world: World, runner: Runner, now: Date): World => {
  const released = runner.release(now);

  return released.isDiscarded
    ? withoutRunner(world, runner)
    : withRunner(world, released);
};

const candidateFor = (world: World, into: Sandbox | null, now: Date): Runner =>
  Runner.start({
    id: RunnerId.of(`runner_${world.next}`),
    through: world.pool,
    host: HOST_ID,
    enters: into?.id ?? null,
    tokenHash: hashOf('b'),
    egressTokenHash: hashOf('e'),
    proxyCredentialHash: null,
    installed: [],
    running: null,
    at: now,
    claimBy: later(now, CLAIM_WINDOW_MS),
  });

const admitted = (
  world: World,
  into: Sandbox | null,
  now: Date,
): {
  readonly world: World;
  readonly runner: Runner | null;
  readonly admission: Admission;
} => {
  const runner = candidateFor(world, into, now);
  const fits = into === null || into.takesRunOn(world.host, now);
  const occupancy = occupancyOf(world, now);
  const open =
    fits &&
    world.pool.capacity(
      'pull',
      into ? occupancy.entering(into.id) : occupancy,
    ) === 'open';
  const takenIfAdmitted = poolSlotsTaken(
    { ...world, runners: [...world.runners, runner] },
    now,
  );
  const admission = { admitted: open, into, fits, takenIfAdmitted };

  return open
    ? {
        world: {
          ...world,
          runners: [...world.runners, runner],
          next: world.next + 1,
        },
        runner,
        admission,
      }
    : { world, runner: null, admission };
};

const openWithKey = (world: World, key: string): Sandbox | null =>
  world.sandboxes.find((each) => each.isOpen && each.key?.value === key) ??
  null;

const heldForRun = (
  world: World,
  key: string,
  run: RunId,
  now: Date,
): World => {
  const open = openWithKey(world, key);

  if (open?.isRequested === true) {
    return replaced(world, open, (each) =>
      each
        .placeOn(world.host, tokenHashOf(each.id.value), now)
        .holdRun(run, now),
    );
  }

  const cleared = open
    ? replaced(world, open, (each) => each.replacedForRun())
    : world;
  const id = `sandbox_${cleared.next}`;

  return {
    ...cleared,
    next: cleared.next + 1,
    sandboxes: [
      ...cleared.sandboxes,
      Sandbox.startForRun({
        id: SandboxId.of(id),
        workspaceId: world.pool.workspaceId,
        key: SandboxKey.of(key),
        host: world.host,
        tokenHash: tokenHashOf(id),
        runId: run,
        at: now,
      }),
    ],
  };
};

const firstRequested = (
  world: World,
  warm: boolean,
  runner: Runner,
): Sandbox | null =>
  world.sandboxes.find((each) =>
    warm ? each.warmFits(runner.offer) : each.isRequested && each.key !== null,
  ) ?? null;

const claimedFresh = (
  world: World,
  outcome: FreshClaim,
  now: Date,
): Omit<Visit, 'step' | 'before' | 'now'> => {
  const { world: entered, runner, admission } = admitted(world, null, now);
  const done = (after: World, warmStart: WarmStart | null = null) => ({
    after,
    admission,
    warmStart,
    warmDrain: null,
  });

  if (!runner) {
    return done(entered);
  }

  switch (outcome.kind) {
    case 'run': {
      const run = RunId.of(`run_${entered.next}`);
      const working = runner.claim(RunnerWork.run(run.value), now);

      return done(
        heldForRun(
          { ...withRunner(entered, working), next: entered.next + 1 },
          outcome.key,
          run,
          now,
        ),
      );
    }
    case 'warm': {
      const takenBefore = hostSlotsTaken(entered, now);
      const requested = firstRequested(entered, true, runner);
      const room = WarmSlots.roomForWarm(entered.host, holdersOf(entered, now));
      const started =
        requested && room
          ? replaced(entered, requested, (each) =>
              each.placeWarmOn(
                entered.host,
                runner.offer,
                tokenHashOf(each.id.value),
                now,
              ),
            )
          : entered;

      return done(letGo(started, runner, now), {
        started: started !== entered,
        requested: requested !== null,
        takenBefore,
      });
    }
    case 'requested': {
      const requested = firstRequested(entered, false, runner);
      const started = requested
        ? replaced(entered, requested, (each) =>
            each.placeOn(entered.host, tokenHashOf(each.id.value), now),
          )
        : entered;

      return done(letGo(started, runner, now));
    }
    case 'waits':
      return done(entered);
    case 'nothing':
      return done(letGo(entered, runner, now));
  }
};

const drainedForWaitingRun = (
  world: World,
  runWaits: boolean,
  now: Date,
): { readonly world: World; readonly drain: WarmDrain } => {
  const onHost = world.sandboxes.filter(
    (each) => each.isLive && each.isOn(HOST_ID),
  );
  const drain = {
    runWaits,
    takenBefore: hostSlotsTaken(world, now),
    anyDraining: onHost.some((each) => each.current === 'draining'),
    candidates: onHost.filter((each) => each.takesFirstRunOn(world.host, now)),
  };
  const chosen = runWaits
    ? WarmSlots.toDrainForQueuedRun(
        world.host,
        holdersOf(world, now),
        onHost,
        now,
      )
    : null;

  return {
    world: chosen
      ? replaced(world, chosen, (each) =>
          each.drainedForQueuedRun(world.host, now),
        )
      : world,
    drain,
  };
};

const claimedInto = (
  world: World,
  step: Extract<Step, { kind: 'claim-into' }>,
  now: Date,
): Omit<Visit, 'step' | 'before' | 'now'> => {
  const live = world.sandboxes.filter((each) => each.isLive);
  const idle = live.filter((each) => each.isIdle);
  const among = idle.length > 0 ? idle : live;
  const into = among.length > 0 ? among[step.pick % among.length] : null;

  if (!into) {
    return { after: world, admission: null, warmStart: null, warmDrain: null };
  }

  const { world: entered, runner, admission } = admitted(world, into, now);
  const done = (after: World, warmDrain: WarmDrain | null = null) => ({
    after,
    admission,
    warmStart: null,
    warmDrain,
  });

  if (!runner) {
    return done(entered);
  }

  switch (step.outcome) {
    case 'waits':
      return done(entered);
    case 'misfit':
      return done(
        letGo(
          into.warm === null
            ? replaced(entered, into, (each) => each.drainedWhenPlaced())
            : entered,
          runner,
          now,
        ),
      );
    case 'nothing': {
      if (into.warm === null) {
        return done(letGo(entered, runner, now));
      }

      const drained = drainedForWaitingRun(entered, step.runWaits, now);

      return done(letGo(drained.world, runner, now), drained.drain);
    }
    case 'run': {
      const run = RunId.of(`run_${entered.next}`);
      const forRun = {
        runId: run,
        workspaceId: entered.pool.workspaceId,
        key: into.key ?? SandboxKey.of(`task-new-${entered.next}`),
        line: LINE,
        lineFingerprint: SETUP,
      };
      const held = replaced(
        { ...entered, next: entered.next + 1 },
        into,
        (each) =>
          each.warm === null
            ? each.holdRunFor(forRun, entered.host, now)
            : each.adoptFor(forRun, entered.host, now),
      );
      const holds = held.sandboxes.some((each) => each.holdsRun(run));

      return done(
        holds
          ? withRunner(held, runner.claim(RunnerWork.run(run.value), now))
          : letGo(held, runner, now),
      );
    }
  }
};

const working = (world: World): readonly Runner[] =>
  world.runners.filter((each) => each.work !== null && !each.hasEnded);

const finished = (
  world: World,
  step: Extract<Step, { kind: 'finish' }>,
  now: Date,
): World => {
  const all = working(world);
  const runner = all.length > 0 ? all[step.pick % all.length] : null;

  if (!runner?.work) {
    return world;
  }

  const run = RunId.of(runner.work.id);

  return {
    ...withRunner(world, runner.ended(now)),
    sandboxes: world.sandboxes.map((each) =>
      each.isLive && each.holdsRun(run)
        ? step.retire
          ? each.retireRun(run, now)
          : each.releaseRun(run, now)
        : each,
    ),
  };
};

const swept = (world: World, now: Date): World => ({
  ...world,
  sandboxes: world.sandboxes
    .map((each) =>
      each
        .drainedWhenDue(DRAIN_POLICY, now)
        .strandedOn(world.host, now)
        .unreportedOn(world.host, now),
    )
    .filter((each) => !each.isExpiredAt(now)),
});

const reportedOn = (world: World, drops: number | null): readonly Sandbox[] => {
  const placed = world.sandboxes.filter(
    (each) => each.isLive && each.isOn(HOST_ID),
  );

  return drops === null
    ? placed
    : placed.filter((_, at) => at !== drops % placed.length);
};

const plain = (after: World) => ({
  after,
  admission: null,
  warmStart: null,
  warmDrain: null,
});

const applied = (
  world: World,
  each: Acting,
  now: Date,
): Omit<Visit, 'step' | 'before' | 'now'> => {
  switch (each.kind) {
    case 'host':
      return plain({ ...world, beats: each.beats, drops: each.drops });
    case 'request-warm': {
      if (world.sandboxes.length >= MOST_SANDBOXES) {
        return plain(world);
      }

      const requested = Sandbox.requestWarm({
        id: SandboxId.of(`sandbox_${world.next}`),
        workspaceId: world.pool.workspaceId,
        warm: WARM,
        at: now,
      });

      return plain({
        ...world,
        next: world.next + 1,
        sandboxes: [...world.sandboxes, requested],
      });
    }
    case 'open': {
      if (
        world.sandboxes.length >= MOST_SANDBOXES ||
        openWithKey(world, each.key)
      ) {
        return plain(world);
      }

      const requested = Sandbox.request({
        id: SandboxId.of(`sandbox_${world.next}`),
        workspaceId: world.pool.workspaceId,
        key: SandboxKey.of(each.key),
        at: now,
      });

      return plain({
        ...world,
        next: world.next + 1,
        sandboxes: [...world.sandboxes, requested],
      });
    }
    case 'runners-beat':
      return plain({
        ...world,
        runners: world.runners.map((runner) =>
          runner.work !== null && runner.isAlive(now)
            ? runner.heartbeat(now)
            : runner,
        ),
      });
    case 'sweep':
      return plain(swept(world, now));
    case 'claim':
      return claimedFresh(world, each.outcome, now);
    case 'claim-into':
      return claimedInto(world, each, now);
    case 'finish':
      return plain(finished(world, each, now));
    case 'let-go': {
      const alive = aliveIn(world, now).filter(
        (runner) => runner.work === null,
      );
      const runner = alive.length > 0 ? alive[each.pick % alive.length] : null;

      return plain(runner ? letGo(world, runner, now) : world);
    }
    case 'dropped': {
      const live = world.sandboxes.filter((sandbox) => sandbox.isLive);
      const sandbox = live.length > 0 ? live[each.pick % live.length] : null;

      return plain(
        sandbox
          ? replaced(world, sandbox, (one) => one.droppedBy(HOST_ID, now))
          : world,
      );
    }
    case 'retire': {
      const open = openWithKey(world, each.key);

      return plain(
        open ? replaced(world, open, (one) => one.retire(now)) : world,
      );
    }
  }
};

const walk = (
  capacity: number,
  maxRuns: number,
  steps: readonly Step[],
): readonly Visit[] => {
  let world = begun(capacity, maxRuns);
  let now = START;
  const visits: Visit[] = [];

  for (const each of steps) {
    if (each.kind === 'wait') {
      now = later(now, each.ms);
      continue;
    }

    const before = world.beats
      ? { ...world, host: hostAt(world, reportedOn(world, world.drops), now) }
      : world;
    const result = applied(before, each, now);

    visits.push({ ...result, step: each, before, now });
    world = result.after;
  }

  return visits;
};

const FILLED_HOST: readonly Step[] = [
  { kind: 'request-warm' },
  { kind: 'request-warm' },
  { kind: 'claim', outcome: { kind: 'warm' } },
  { kind: 'wait', ms: 5_000 },
  { kind: 'claim', outcome: { kind: 'warm' } },
  { kind: 'claim', outcome: { kind: 'run', key: 'task-a' } },
  { kind: 'claim', outcome: { kind: 'run', key: 'task-b' } },
];

const steps = fc.oneof(
  fc.array(step, { maxLength: 60, size: 'max' }),
  fc
    .array(step, { maxLength: 50, size: 'max' })
    .map((rest) => [...FILLED_HOST, ...rest]),
);

const capacity = weighted([1, 1], [4, 2], [3, 3], [1, 4]);

const RUNS = { numRuns: 2_000 };

const slots = (holds: (visit: Visit) => boolean) =>
  fc.property(
    capacity,
    fc.integer({ min: 1, max: 6 }),
    steps,
    (capacity, maxRuns, each) => walk(capacity, maxRuns, each).every(holds),
  );

const oldest = (sandboxes: readonly Sandbox[]): Sandbox | null =>
  [...sandboxes].sort(
    (a, b) =>
      a.startedAt.getTime() - b.startedAt.getTime() ||
      a.id.value.localeCompare(b.id.value),
  )[0] ?? null;

const closedBy = ({ before, after }: Visit): readonly Sandbox[] =>
  before.sandboxes.filter(
    (each) =>
      each.isOpen &&
      after.sandboxes.some((one) => one.id.equals(each.id) && !one.isOpen),
  );

describe('the slots of a host and its pool under any order of claims, runs and sweeps', () => {
  it('admits a runner exactly when the pool has room for it, an idle sandbox and the runner that enters it counting as one', () => {
    fc.assert(
      slots(({ admission, before }) => {
        if (admission === null) {
          return true;
        }

        return (
          admission.admitted ===
          (admission.fits && admission.takenIfAdmitted <= before.maxRuns)
        );
      }),
      RUNS,
    );
  });

  it('admits a runner into an idle sandbox nobody waits in without taking another slot', () => {
    fc.assert(
      slots(({ admission, before, now }) => {
        const into = admission?.into ?? null;

        return (
          admission === null ||
          into === null ||
          !admission.fits ||
          enteredBy(aliveIn(before, now), into) ||
          admission.takenIfAdmitted === poolSlotsTaken(before, now)
        );
      }),
      RUNS,
    );
  });

  it('starts a warm sandbox exactly when one is requested and a host slot stays free after it', () => {
    fc.assert(
      slots(({ warmStart, before, after, now }) => {
        if (warmStart === null) {
          return true;
        }

        return (
          warmStart.started ===
            (warmStart.requested &&
              warmStart.takenBefore + 1 < before.capacity) &&
          (!warmStart.started || hostSlotsTaken(after, now) < after.capacity)
        );
      }),
      RUNS,
    );
  });

  it('drains for a waiting run only on a full host with nothing draining, and then the oldest warm sandbox that waits for its first run', () => {
    fc.assert(
      slots((visit) => {
        const { warmDrain, before } = visit;
        const drained = closedBy(visit);

        if (warmDrain === null) {
          return true;
        }

        const due =
          warmDrain.runWaits &&
          warmDrain.takenBefore >= before.capacity &&
          !warmDrain.anyDraining &&
          warmDrain.candidates.length > 0;
        const expected = oldest(warmDrain.candidates);

        return due
          ? drained.length === 1 &&
              expected !== null &&
              drained[0].id.equals(expected.id)
          : drained.length === 0;
      }),
      RUNS,
    );
  });

  it('puts at most one run, and one runner at work, in each sandbox', () => {
    fc.assert(
      slots(({ after, now }) =>
        after.sandboxes.every(
          (sandbox) =>
            sandbox.leases.filter((each) => each.isForRun).length <= 1 &&
            aliveIn(after, now).filter(
              (each) =>
                each.work !== null &&
                (each.enters?.equals(sandbox.id) ?? false),
            ).length <= 1,
        ),
      ),
      RUNS,
    );
  });
});
