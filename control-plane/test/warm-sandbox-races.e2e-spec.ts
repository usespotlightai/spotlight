import { randomUUID } from 'node:crypto';

import { CryptoIdGenerator } from '@platform/ids/crypto-id.generator';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RandomTokenIssuer } from '@platform/tokens/random-token-issuer.service';
import { HostWarmSlots } from '@runners/application/services/host-warm-slots.service';
import { Sandboxes } from '@runners/application/services/sandboxes.service';
import { WarmSandboxes } from '@runners/application/services/warm-sandboxes.service';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { SandboxReport } from '@runners/domain/value-objects/sandbox-report.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { DrizzleHostSlotLocks } from '@runners/infrastructure/persistence/drizzle/host-slot-locks';
import { DrizzleSandboxPlacements } from '@runners/infrastructure/persistence/drizzle/readers/sandbox-placements.reader';
import { DrizzleRunnerHostRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-host.repository';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleSandboxRepository } from '@runners/infrastructure/persistence/drizzle/repositories/sandbox.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-01-02T03:04:05.000Z');
const AT = new Date(NOW.getTime() + 1_000);
const LINE = 'line_1';
const SETUP = 'setup_1';
const OFFER = RunnerOffer.of(['gpu', 'linux']);

const WARM = WarmPart.of({
  lineId: LineId.of(LINE),
  placement: RunnerPlacement.of(['gpu']),
  checkouts: [{ path: 'widgets', setup: 'npm ci' }],
  fingerprint: SETUP,
});

const POLICY = SandboxDrainPolicy.of({
  graceMs: 10 * 60_000,
  editorLimitMs: 12 * 60 * 60_000,
  warmAgeMs: 24 * 60 * 60_000,
});

const RUNS = [
  { name: 'run_1', key: 'task-a' },
  { name: 'run_2', key: 'task-b' },
  { name: 'run_3', key: 'task-a' },
] as const;

const silent: LoggerPort = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const clock: ClockPort = { now: () => AT, sleep: async () => {} };

let database: TestDatabase;
let sandboxes: DrizzleSandboxRepository;
let hosts: DrizzleRunnerHostRepository;
let service: Sandboxes;
let warm: WarmSandboxes;
let slots: HostWarmSlots;

beforeAll(async () => {
  database = await openDatabase('warm_sandbox_races');

  const context = new DrizzleContext(database.db);
  const events = { dispatch: async () => {} };
  const ids = new CryptoIdGenerator();

  sandboxes = new DrizzleSandboxRepository(context, events);
  hosts = new DrizzleRunnerHostRepository(context, events);
  service = new Sandboxes(
    sandboxes,
    hosts,
    new DrizzleSandboxPlacements(context),
    POLICY,
    ids,
    new RandomTokenIssuer(),
    clock,
    silent,
  );
  warm = new WarmSandboxes(sandboxes, ids, silent);
  slots = new HostWarmSlots(
    sandboxes,
    hosts,
    new DrizzleRunnerRepository(context, events),
    new DrizzleHostSlotLocks(context),
    silent,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

interface Place {
  readonly workspaceId: WorkspaceId;
  readonly host: RunnerHost;
  readonly tag: string;
}

const hostIn = async (
  capacity: number,
  reported: readonly string[],
): Promise<Place> => {
  const tag = randomUUID().replaceAll('-', '');
  const workspaceId = WorkspaceId.of(`ws_${tag}`);
  const host = RunnerHost.fromHeartbeat({
    id: HostId.of(`host_${tag}`),
    workspaceId,
    source: CredentialSource.ofId(PoolId.of(`pool_${tag}`)),
    bootId: BootId.of('boot_1'),
    report: HostReport.of({
      name: 'build-box',
      release: '0.9.0',
      containerRuntime: 'docker',
      capacity,
      running: [],
      images: [
        {
          image: 'ghcr.io/acme/runner:main',
          isDefault: true,
          harnesses: [{ id: 'claude-code', models: [], version: '2.1.0' }],
        },
      ],
    }),
    sandboxes: SandboxReport.of({ sandboxes: [...reported], stopping: false }),
    at: NOW,
  });

  await hosts.add(host);

  return { workspaceId, host, tag };
};

const tokenOf = (id: string): TokenHash =>
  TokenHash.of(new RandomTokenIssuer().hash(id));

const warmOn = async (place: Place, id: string): Promise<void> => {
  await sandboxes.add(
    Sandbox.requestWarm({
      id: SandboxId.of(id),
      workspaceId: place.workspaceId,
      warm: WARM,
      at: NOW,
    }).placeWarmOn(place.host, OFFER, tokenOf(id), NOW),
  );
};

const refused = (error: unknown): boolean => error instanceof DomainError;

const settledAll = async <T>(
  all: readonly (() => Promise<T>)[],
): Promise<readonly PromiseSettledResult<T>[]> => {
  const settled = await Promise.allSettled(all.map((each) => each()));

  for (const each of settled) {
    if (each.status === 'rejected' && !refused(each.reason)) {
      throw each.reason;
    }
  }

  return settled;
};

type Action =
  | {
      readonly kind: 'adopt';
      readonly sandbox: number;
      readonly run: number;
      readonly line: string;
      readonly fingerprint: string;
    }
  | { readonly kind: 'retire-warm'; readonly sandbox: number }
  | { readonly kind: 'release'; readonly run: number }
  | { readonly kind: 'drain-for-queued' | 'sweep' };

const sandboxIndex = fc.integer({ min: 0, max: 1 });

const runIndex = fc.integer({ min: 0, max: RUNS.length - 1 });

const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('adopt' as const),
      sandbox: sandboxIndex,
      run: runIndex,
      line: fc.oneof(
        { weight: 4, arbitrary: fc.constant(LINE) },
        { weight: 1, arbitrary: fc.constant('line_2') },
      ),
      fingerprint: fc.oneof(
        { weight: 4, arbitrary: fc.constant(SETUP) },
        { weight: 1, arbitrary: fc.constant('setup_2') },
      ),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('retire-warm' as const),
      sandbox: sandboxIndex,
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('release' as const),
      run: runIndex,
    }),
  },
  { weight: 2, arbitrary: fc.constant({ kind: 'drain-for-queued' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'sweep' as const }) },
);

const actions = fc.array(action, { minLength: 2, maxLength: 5 });

interface WarmRace {
  readonly place: Place;
  readonly ids: readonly string[];
  readonly runIds: readonly string[];
  readonly stored: readonly Sandbox[];
  readonly adopted: readonly Extract<Action, { kind: 'adopt' }>[];
  readonly all: readonly Action[];
}

const performed = (
  race: Pick<WarmRace, 'place' | 'ids' | 'runIds'>,
  each: Action,
): Promise<boolean> => {
  const { place, ids, runIds } = race;

  switch (each.kind) {
    case 'adopt':
      return service.adoptForRun(
        ids[each.sandbox],
        {
          workspaceId: place.workspaceId.value,
          key: RUNS[each.run].key,
          line: each.line,
          lineFingerprint: each.fingerprint,
          hostId: place.host.id.value,
          runId: runIds[each.run],
        },
        AT,
      );
    case 'retire-warm':
      return warm.retire(ids[each.sandbox]).then(() => true);
    case 'release':
      return service.releaseRun(runIds[each.run], AT).then(() => true);
    case 'drain-for-queued':
      return slots
        .drainIdleOn(place.host.id.value, AT, async () => true)
        .then(() => true);
    case 'sweep':
      return service.drainIdle(AT).then(() => true);
  }
};

const warmRace = async (all: readonly Action[]): Promise<WarmRace> => {
  const tag = randomUUID().replaceAll('-', '');
  const ids = [`sandbox_${tag}_1`, `sandbox_${tag}_2`];
  const place = await hostIn(2, ids);
  const runIds = RUNS.map((each) => `${each.name}_${tag}`);

  for (const id of ids) {
    await warmOn(place, id);
  }

  const settled = await settledAll(
    all.map((each) => () => performed({ place, ids, runIds }, each)),
  );
  const stored: Sandbox[] = [];

  for (const id of ids) {
    const found = await sandboxes.find(SandboxId.of(id));

    if (!found) {
      throw new Error(`Sandbox ${id} is gone after the race.`);
    }

    stored.push(found);
  }

  return {
    place,
    ids,
    runIds,
    stored,
    all,
    adopted: all.flatMap((each, at) => {
      const result = settled[at];

      return each.kind === 'adopt' &&
        result.status === 'fulfilled' &&
        result.value
        ? [each]
        : [];
    }),
  };
};

const RACES = { numRuns: 60 };

const warmRaced = (holds: (race: WarmRace) => boolean) =>
  fc.asyncProperty(actions, async (all) => holds(await warmRace(all)));

const runsIn = (sandbox: Sandbox): readonly string[] =>
  sandbox.leases.flatMap((each) => (each.isForRun ? [each.holder.id] : []));

const letGo = (all: readonly Action[], run: number): boolean =>
  all.some((each) => each.kind === 'release' && each.run === run);

describe('two placed warm sandboxes raced by adopting runs, retirements, drains and sweeps', () => {
  it('lets one run at most adopt each warm sandbox', async () => {
    await fc.assert(
      warmRaced(({ adopted, stored }) =>
        stored.every((sandbox, at) => {
          const winners = new Set(
            adopted
              .filter((each) => each.sandbox === at)
              .map((each) => each.run),
          );

          return winners.size <= 1 && runsIn(sandbox).length <= 1;
        }),
      ),
      RACES,
    );
  }, 180_000);

  it('is adopted only by a run of its line and setup', async () => {
    await fc.assert(
      warmRaced(({ adopted }) =>
        adopted.every(
          (each) => each.line === LINE && each.fingerprint === SETUP,
        ),
      ),
      RACES,
    );
  }, 180_000);

  it('gives each key one open sandbox and each run one sandbox at most', async () => {
    await fc.assert(
      warmRaced(({ stored }) => {
        const keys = stored.flatMap((each) =>
          each.isOpen && each.key ? [each.key.value] : [],
        );
        const runs = stored.flatMap(runsIn);

        return (
          new Set(keys).size === keys.length &&
          new Set(runs).size === runs.length
        );
      }),
      RACES,
    );
  }, 180_000);

  it('holds each run that adopted it under that run’s key until the run lets go', async () => {
    await fc.assert(
      warmRaced(({ adopted, stored, runIds, all }) =>
        adopted.every((each) => {
          const sandbox = stored[each.sandbox];

          return (
            letGo(all, each.run) ||
            (sandbox.holdsRun(RunId.of(runIds[each.run])) &&
              sandbox.key?.equals(SandboxKey.of(RUNS[each.run].key)) === true)
          );
        }),
      ),
      RACES,
    );
  }, 180_000);

  it('never drains a sandbox a run holds, and keeps it warm only while no run took it', async () => {
    await fc.assert(
      warmRaced(({ stored }) =>
        stored.every(
          (sandbox) =>
            runsIn(sandbox).length === 0 ||
            (sandbox.isOpen && sandbox.warm === null && sandbox.key !== null),
        ),
      ),
      RACES,
    );
  }, 180_000);

  it('drains one warm sandbox at most for queued runs on a full host', async () => {
    await fc.assert(
      warmRaced(
        ({ stored, all }) =>
          all.some((each) => each.kind === 'retire-warm') ||
          stored.filter((each) => each.current === 'draining').length <= 1,
      ),
      RACES,
    );
  }, 180_000);
});

interface Crowd {
  readonly capacity: number;
  readonly taken: number;
  readonly requested: number;
  readonly claims: number;
}

const crowd: fc.Arbitrary<Crowd> = fc.record({
  capacity: fc.integer({ min: 2, max: 4 }),
  taken: fc.integer({ min: 0, max: 3 }),
  requested: fc.integer({ min: 1, max: 4 }),
  claims: fc.integer({ min: 2, max: 5 }),
});

interface StartRace {
  readonly crowd: Crowd;
  readonly started: number;
  readonly placedWarm: number;
}

const startRace = async (input: Crowd): Promise<StartRace> => {
  const tag = randomUUID().replaceAll('-', '');
  const takenIds = Array.from(
    { length: input.taken },
    (_, at) => `idle_${tag}_${at}`,
  );
  const place = await hostIn(input.capacity, takenIds);

  for (const [at, id] of takenIds.entries()) {
    await sandboxes.add(
      Sandbox.request({
        id: SandboxId.of(id),
        workspaceId: place.workspaceId,
        key: SandboxKey.of(`task-${at}`),
        at: NOW,
      }).placeOn(place.host, tokenOf(id), NOW),
    );
  }

  const requested = Array.from(
    { length: input.requested },
    (_, at) => `warm_${tag}_${at}`,
  );

  for (const id of requested) {
    await sandboxes.add(
      Sandbox.requestWarm({
        id: SandboxId.of(id),
        workspaceId: place.workspaceId,
        warm: WARM,
        at: NOW,
      }),
    );
  }

  const claim = () =>
    slots.startWarmIfRoomOn(place.host.id.value, AT, async () => {
      for (const id of requested) {
        const started = await service.startWarm(
          id,
          place.host.id.value,
          OFFER,
          AT,
        );

        if (started) {
          return started;
        }
      }

      return null;
    });
  const settled = await settledAll(
    Array.from({ length: input.claims }, () => claim),
  );
  const placedWarm = (await sandboxes.openWarmIn(place.workspaceId)).filter(
    (each) => each.isPlaced,
  ).length;

  return {
    crowd: input,
    started: settled.filter(
      (each) => each.status === 'fulfilled' && each.value !== null,
    ).length,
    placedWarm,
  };
};

const startRaced = (holds: (race: StartRace) => boolean) =>
  fc.asyncProperty(crowd, async (input) => holds(await startRace(input)));

const room = ({ capacity, taken }: Crowd): number =>
  Math.max(0, capacity - 1 - taken);

describe('claims of one host racing to start requested warm sandboxes', () => {
  it('never starts a warm sandbox in the last free slot of the host', async () => {
    await fc.assert(
      startRaced(
        ({ crowd: input, started, placedWarm }) =>
          started === placedWarm && started <= room(input),
      ),
      RACES,
    );
  }, 180_000);

  it('starts as many warm sandboxes as the claims, the requests and the free slots allow', async () => {
    await fc.assert(
      startRaced(
        ({ crowd: input, started }) =>
          started === Math.min(input.claims, input.requested, room(input)),
      ),
      RACES,
    );
  }, 180_000);
});
