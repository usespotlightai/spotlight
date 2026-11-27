import { Instance } from '@platform/cluster/instance';
import type { LiveNoticeLogPort } from '@platform/live/live-notice-log.port';
import { LiveNoticeRetentionWorker } from '@platform/live/live-notice-retention.worker';
import { Leadership } from '@platform/redis/leadership';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const START = Date.parse('2026-11-20T09:00:00.000Z');
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const BATCH = 1_000;
const BATCHES = 50;

const logger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

class SteppedLeadership extends Leadership {
  leading = true;

  constructor() {
    super(null, new Instance('http://10.0.0.2:3000'), logger);
  }

  override held(): boolean {
    return this.leading;
  }
}

interface Batch {
  readonly recordedAt: number;
  count: number;
}

interface Prune {
  readonly before: number;
  readonly limit: number;
  readonly resolve: (count: number) => void;
  readonly reject: (error: Error) => void;
}

class SteppedLog implements LiveNoticeLogPort {
  readonly batches: Batch[] = [];
  readonly pruning: Prune[] = [];
  readonly befores: number[] = [];
  mostAtOnce = 0;
  stopped = false;
  prunedAfterStop = false;

  append(): never {
    throw new Error('Retention never appends.');
  }

  logs(): never {
    throw new Error('Retention never reads.');
  }

  prune(before: Date, limit: number): Promise<number> {
    this.prunedAfterStop ||= this.stopped;
    this.befores.push(before.getTime());

    return new Promise((resolve, reject) => {
      this.pruning.push({ before: before.getTime(), limit, resolve, reject });
      this.mostAtOnce = Math.max(this.mostAtOnce, this.pruning.length);
    });
  }

  older(than: number): number {
    return this.batches
      .filter((batch) => batch.recordedAt < than)
      .reduce((sum, batch) => sum + batch.count, 0);
  }

  total(): number {
    return this.batches.reduce((sum, batch) => sum + batch.count, 0);
  }

  finish(fails: boolean): void {
    const prune = this.pruning.shift();

    if (!prune) {
      return;
    }

    if (fails) {
      prune.reject(new Error('database gone'));
      return;
    }

    let left = prune.limit;

    for (const batch of this.batches) {
      if (batch.recordedAt < prune.before) {
        const taken = Math.min(left, batch.count);
        batch.count -= taken;
        left -= taken;
      }
    }

    prune.resolve(prune.limit - left);
  }
}

type Step =
  | { readonly kind: 'record'; readonly count: number }
  | { readonly kind: 'wait'; readonly ms: number }
  | { readonly kind: 'tick' }
  | { readonly kind: 'finish'; readonly fails: boolean }
  | { readonly kind: 'lead'; readonly leading: boolean }
  | { readonly kind: 'stop' };

const step: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('record' as const),
      count: fc.oneof(
        fc.integer({ min: 1, max: 1_500 }),
        fc.integer({ min: 20_000, max: 30_000 }),
      ),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      ms: fc.oneof(
        fc.integer({ min: 0, max: HOUR_MS }),
        fc.integer({ min: 20 * HOUR_MS, max: 30 * HOUR_MS }),
      ),
    }),
  },
  { weight: 8, arbitrary: fc.constant<Step>({ kind: 'tick' }) },
  {
    weight: 24,
    arbitrary: fc.record({
      kind: fc.constant('finish' as const),
      fails: fc.oneof(
        { weight: 8, arbitrary: fc.constant(false) },
        { weight: 1, arbitrary: fc.constant(true) },
      ),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('lead' as const),
      leading: fc.boolean(),
    }),
  },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: 'stop' }) },
);

interface Sweep {
  readonly cutoff: number;
  readonly older: number;
  readonly leading: boolean;
  readonly stopping: boolean;
  deleted: number | null;
  befores: readonly number[];
}

class ObservedWorker extends LiveNoticeRetentionWorker {
  readonly sweeps: Sweep[] = [];
  active = 0;
  mostActive = 0;
  stopping = false;

  constructor(
    private readonly stored: SteppedLog,
    private readonly leader: SteppedLeadership,
    private readonly nowOf: () => number,
  ) {
    super(
      stored,
      leader,
      { now: () => new Date(nowOf()), sleep: async () => undefined },
      logger,
    );
  }

  override async sweep(): Promise<number> {
    const cutoff = this.nowOf() - DAY_MS;
    const from = this.stored.befores.length;
    const sweep: Sweep = {
      cutoff,
      older: this.stored.older(cutoff),
      leading: this.leader.leading,
      stopping: this.stopping,
      deleted: null,
      befores: [],
    };
    this.sweeps.push(sweep);
    this.active += 1;
    this.mostActive = Math.max(this.mostActive, this.active);

    try {
      sweep.deleted = await super.sweep();
      return sweep.deleted;
    } finally {
      sweep.befores = this.stored.befores.slice(from);
      this.active -= 1;
    }
  }
}

interface Tick {
  readonly leading: boolean;
  readonly stopping: boolean;
  readonly idle: boolean;
  readonly started: boolean;
}

interface Walked {
  readonly log: SteppedLog;
  readonly worker: ObservedWorker;
  readonly ticks: readonly Tick[];
  readonly activeWhenStopped: number | null;
}

const flushed = () => new Promise<void>((resolve) => setImmediate(resolve));

const walked = async (steps: readonly Step[]): Promise<Walked> => {
  let now = START;
  const leadership = new SteppedLeadership();
  const log = new SteppedLog();
  const worker = new ObservedWorker(log, leadership, () => now);
  const ticks: Tick[] = [];
  let stopping: Promise<void> | null = null;
  let activeWhenStopped: number | null = null;

  for (const each of steps) {
    switch (each.kind) {
      case 'record':
        log.batches.push({ recordedAt: now, count: each.count });
        break;
      case 'wait':
        now += each.ms;
        break;
      case 'tick': {
        const before = worker.sweeps.length;
        const idle = worker.active === 0;
        void worker.tick();
        ticks.push({
          leading: leadership.leading,
          stopping: worker.stopping,
          idle,
          started: worker.sweeps.length > before,
        });
        break;
      }
      case 'finish':
        log.finish(each.fails);
        break;
      case 'lead':
        leadership.leading = each.leading;
        break;
      case 'stop':
        worker.stopping = true;
        stopping ??= worker.onModuleDestroy().then(() => {
          activeWhenStopped = worker.active;
          log.stopped = true;
        });
        break;
    }

    await flushed();
  }

  while (log.pruning.length > 0 || worker.active > 0) {
    log.finish(false);
    await flushed();
  }

  await stopping;

  return { log, worker, ticks, activeWhenStopped };
};

const RUNS = { numRuns: 200 };

const walking = (holds: (walk: Walked) => boolean) =>
  fc.asyncProperty(
    fc.array(step, { maxLength: 60, size: 'max' }),
    async (steps) => holds(await walked(steps)),
  );

describe('LiveNoticeRetentionWorker under random ticks, leadership changes and slow deletes', () => {
  it('runs one sweep at a time, with one delete in flight', async () => {
    await fc.assert(
      walking(
        ({ log, worker }) => worker.mostActive <= 1 && log.mostAtOnce <= 1,
      ),
      RUNS,
    );
  }, 60_000);

  it('starts a sweep only while it leads and before it is told to stop', async () => {
    await fc.assert(
      walking(({ worker }) =>
        worker.sweeps.every((sweep) => sweep.leading && !sweep.stopping),
      ),
      RUNS,
    );
  }, 60_000);

  it('starts a sweep on every tick while it leads, runs none and is not stopping, also after a failed one', async () => {
    await fc.assert(
      walking(({ ticks }) =>
        ticks.every(
          (tick) =>
            tick.started === (tick.leading && !tick.stopping && tick.idle),
        ),
      ),
      RUNS,
    );
  }, 60_000);

  it('finishes its running sweep before it stops, and deletes nothing after', async () => {
    await fc.assert(
      walking(
        ({ log, activeWhenStopped }) =>
          (activeWhenStopped ?? 0) === 0 && !log.prunedAfterStop,
      ),
      RUNS,
    );
  }, 60_000);

  it('deletes the notices older than a day in batches, up to 50 batches a sweep, and none newer', async () => {
    await fc.assert(
      walking(({ worker }) =>
        worker.sweeps.every(
          (sweep) =>
            sweep.deleted === null ||
            (sweep.deleted === Math.min(sweep.older, BATCH * BATCHES) &&
              sweep.befores.every((before) => before === sweep.cutoff) &&
              sweep.befores.length ===
                Math.min(BATCHES, Math.floor(sweep.older / BATCH) + 1)),
        ),
      ),
      RUNS,
    );
  }, 60_000);
});
