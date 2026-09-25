import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type {
  HeldWork,
  ProvisionedRunner,
  RunnersPort,
} from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type {
  CheckProvisioningPort,
  WaitingCheck,
} from '@work/application/ports/check-provisioning.port';
import type { ProvisionFailures } from '@work/application/services/provision-failures.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { poolCouldTake } from '@work/domain/services/pool-fit';

const MOST_AT_ONCE = 20;

const PAGE = 200;

const MOST_PAGES = 10;

type Provisioned = 'settled' | 'try-another';

interface Then {
  readonly failed: (failure: ProvisionFailure) => Promise<unknown>;
  readonly unreserved: () => Promise<unknown>;
}

interface Waiting {
  readonly placement: RunnerPlacement;
  readonly on: (pool: PoolAtWork, last: boolean) => Promise<Provisioned>;
}

const rethrown = (thrown: readonly unknown[]): void => {
  if (thrown.length > 1) {
    throw new AggregateError(thrown, 'Several provisioning attempts threw');
  }

  if (thrown.length === 1) {
    throw thrown[0];
  }
};

const everySettled = async (
  attempts: readonly Promise<unknown>[],
): Promise<void> => {
  rethrown(
    (await Promise.allSettled(attempts))
      .filter(
        (each): each is PromiseRejectedResult => each.status === 'rejected',
      )
      .map((each) => each.reason),
  );
};

const byWorkspace = (
  pools: readonly PoolAtWork[],
): ReadonlyMap<string, readonly PoolAtWork[]> => {
  const grouped = new Map<string, PoolAtWork[]>();

  for (const pool of pools) {
    const held = grouped.get(pool.workspaceId.value) ?? [];
    held.push(pool);
    grouped.set(pool.workspaceId.value, held);
  }

  for (const held of grouped.values()) {
    held.sort((one, other) =>
      one.key < other.key ? -1 : one.key > other.key ? 1 : 0,
    );
  }

  return grouped;
};

export class ProvisionWork {
  constructor(
    private readonly runs: RunRepository,
    private readonly checks: CheckProvisioningPort,
    private readonly pools: RunnerPoolsPort,
    private readonly runners: RunnersPort,
    private readonly failures: ProvisionFailures,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async due(): Promise<void> {
    await this.lapsed();

    await everySettled(
      [...byWorkspace(await this.pools.provisioning()).values()].map((pools) =>
        this.inWorkspace(pools),
      ),
    );
  }

  private async inWorkspace(pools: readonly PoolAtWork[]): Promise<void> {
    const [first] = pools;

    if (!first) {
      return;
    }

    const room = new Map(
      await Promise.all(
        pools.map(
          async (pool) =>
            [
              pool.poolId,
              pool.maxRuns === null
                ? Number.POSITIVE_INFINITY
                : pool.maxRuns -
                  (await this.pools.running(pool.poolId, this.clock.now())),
            ] as const,
        ),
      ),
    );
    const placed: { waiting: Waiting; fitting: readonly PoolAtWork[] }[] = [];
    const place = (waiting: Waiting): void => {
      const fitting = pools.filter(
        (each) =>
          (room.get(each.poolId) ?? 0) > 0 &&
          poolCouldTake(waiting.placement, each.labels),
      );
      const [chosen] = fitting;

      if (chosen && placed.length < MOST_AT_ONCE) {
        room.set(chosen.poolId, (room.get(chosen.poolId) ?? 0) - 1);
        placed.push({ waiting, fitting });
      }
    };

    for (const page of [
      (skip: number) =>
        this.runs
          .awaitingProvision(first.workspaceId, this.clock.now(), {
            skip,
            most: PAGE,
          })
          .then((runs) => runs.map((run) => this.waitingRun(run))),
      (skip: number) =>
        this.checks
          .awaiting(first.workspaceId, this.clock.now(), { skip, most: PAGE })
          .then((checks) => checks.map((check) => this.waitingCheck(check))),
    ]) {
      for (
        let at = 0;
        at < MOST_PAGES &&
        placed.length < MOST_AT_ONCE &&
        [...room.values()].some((left) => left > 0);
        at++
      ) {
        const waiting = await page(at * PAGE);

        waiting.forEach(place);

        if (waiting.length < PAGE) {
          break;
        }
      }
    }

    await everySettled(
      placed.map(async ({ waiting, fitting }) => {
        const thrown: unknown[] = [];

        for (const [at, pool] of fitting.entries()) {
          try {
            if (
              (await waiting.on(pool, at === fitting.length - 1)) !==
              'try-another'
            ) {
              break;
            }
          } catch (error) {
            thrown.push(error);
          }
        }

        rethrown(thrown);
      }),
    );
  }

  private async lapsed(): Promise<void> {
    const now = this.clock.now();

    for (const run of await this.runs.withLapsedReservations(now)) {
      const { reservation } = run;

      if (reservation && run.reservationLapsedAt(now)) {
        await this.failures.failed(
          run.id,
          reservation.runner,
          ProvisionFailure.lapsed(reservation.until),
          now,
        );
        await this.runners.letGo(reservation.runner, now);
      }
    }

    for (const check of await this.checks.lapsed(now)) {
      await this.checks.failed(
        check.stackId,
        check.runner,
        ProvisionFailure.lapsed(check.until),
        now,
      );
      await this.runners.letGo(check.runner, now);
    }
  }

  private waitingRun(queued: Run): Waiting {
    return {
      placement: queued.placement,
      on: (pool, last) => this.runOn(queued, pool, last),
    };
  }

  private waitingCheck(check: WaitingCheck): Waiting {
    return {
      placement: check.placement,
      on: (pool, last) => this.checkOn(check, pool, last),
    };
  }

  private async runOn(
    queued: Run,
    pool: PoolAtWork,
    last: boolean,
  ): Promise<Provisioned> {
    const waiting = await this.runs.findById(queued.id);

    if (!waiting?.provisionableAt(this.clock.now())) {
      return 'settled';
    }

    const runnerId = RunnerId.of(this.ids.generate());
    const reserved = waiting.reservedFor(
      runnerId,
      pool.poolId,
      this.clock.now(),
    );
    const { reservation } = reserved;

    if (!reservation) {
      return 'settled';
    }

    try {
      await this.runs.save(reserved);
    } catch (error) {
      if (error instanceof RunMovedOnError) {
        return 'settled';
      }

      throw error;
    }

    return this.attempted(
      () =>
        this.provisioned(pool, runnerId, {
          work: { kind: 'run', id: reserved.id.value },
          runId: reserved.id.value,
          taskId: reserved.taskId?.value ?? null,
          placement: reserved.placement,
          claimBy: reservation.until,
        }),
      {
        failed: (failure) =>
          this.failures.failed(
            reserved.id,
            runnerId,
            failure,
            this.clock.now(),
          ),
        unreserved: () => this.failures.unreserved(reserved.id, runnerId),
      },
      last,
    );
  }

  private async checkOn(
    check: WaitingCheck,
    pool: PoolAtWork,
    last: boolean,
  ): Promise<Provisioned> {
    const runnerId = RunnerId.of(this.ids.generate());
    const until = await this.checks.reserve(
      check.stackId,
      runnerId,
      pool.poolId,
      this.clock.now(),
    );

    if (!until) {
      return 'settled';
    }

    return this.attempted(
      () =>
        this.provisioned(pool, runnerId, {
          work: { kind: 'check', id: check.stackId },
          runId: check.runId,
          taskId: null,
          placement: check.placement,
          claimBy: until,
        }),
      {
        failed: (failure) =>
          this.checks.failed(
            check.stackId,
            runnerId,
            failure,
            this.clock.now(),
          ),
        unreserved: () => this.checks.unreserve(check.stackId, runnerId),
      },
      last,
    );
  }

  private provisioned(
    pool: PoolAtWork,
    runnerId: RunnerId,
    reserved: {
      readonly work: HeldWork;
      readonly runId: string;
      readonly taskId: string | null;
      readonly placement: RunnerPlacement;
      readonly claimBy: Date;
    },
  ): Promise<ProvisionedRunner> {
    return this.runners.provision(
      {
        poolId: pool.poolId,
        runnerId,
        work: reserved.work,
        runId: reserved.runId,
        taskId: reserved.taskId,
        labels: reserved.placement.selectors,
        image: reserved.placement.image?.value ?? null,
        claimBy: reserved.claimBy,
      },
      this.clock.now(),
    );
  }

  private async attempted(
    provisioning: () => Promise<ProvisionedRunner>,
    then: Then,
    last: boolean,
  ): Promise<Provisioned> {
    let provisioned: ProvisionedRunner;

    try {
      provisioned = await provisioning();
    } catch (error) {
      await then.unreserved().catch((released: unknown) => {
        throw new AggregateError(
          [error, released],
          'Provisioning threw, and so did releasing its reservation',
        );
      });
      throw error;
    }

    return this.answered(provisioned, then, last);
  }

  private async answered(
    provisioned: ProvisionedRunner,
    then: Then,
    last: boolean,
  ): Promise<Provisioned> {
    if (provisioned.outcome === 'provisioned') {
      return 'settled';
    }

    if (provisioned.outcome === 'failed' && last) {
      await then.failed(
        ProvisionFailure.of(provisioned.kind, provisioned.detail),
      );
      return 'settled';
    }

    await then.unreserved();
    return 'try-another';
  }
}
