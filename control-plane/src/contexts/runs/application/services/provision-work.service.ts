import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type {
  ProvisionedRunner,
  RunnersPort,
  WorkToProvision,
} from '@runners/application/ports/runners.port';
import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import type {
  ReviewWorkProvisioningPort,
  WaitingReviewWork,
} from '@runs/application/ports/review-work-provisioning.port';
import type { ProvisionFailures } from '@runs/application/services/provision-failures.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ClaimOrder } from '@runs/domain/services/claim-order';
import {
  offerOrder,
  type PoolOnOffer,
  PoolRoom,
  poolChoiceFor,
} from '@runs/domain/services/pool-choice';
import { poolFits } from '@runs/domain/services/pool-fit';
import { ProvisionPlan } from '@runs/domain/services/provision-plan';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { OncePer } from '@shared-kernel/application/services/once-per';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MAX_AT_ONCE = 20;

const PAGE = 200;

const MAX_PAGES = 10;

const NOTED_FOR_MS = 10 * 60_000;

type Provisioned = 'done' | 'try-another';

type OfferedPool = PoolAtWork & PoolOnOffer;

interface Then {
  readonly failed: (failure: ProvisionFailure) => Promise<unknown>;
  readonly unreserved: () => Promise<unknown>;
}

interface Provisionable {
  readonly key: string;
  readonly ids: Readonly<Record<string, string | undefined>>;
  readonly placement: RunnerPlacement;
  readonly needsEgress: boolean;
  readonly on: (pool: OfferedPool, last: boolean) => Promise<Provisioned>;
}

const rethrown = (thrown: readonly unknown[]): void => {
  if (thrown.length > 1) {
    throw new AggregateError(thrown, 'Several provisioning attempts threw');
  }

  if (thrown.length === 1) {
    throw thrown[0];
  }
};

const awaitAll = async (
  attempts: readonly Promise<unknown>[],
): Promise<void> => {
  rethrown(
    (await Promise.allSettled(attempts))
      .filter(
        (each): each is PromiseRejectedResult => each.status === 'rejected',
      )
      .map((each): unknown => each.reason),
  );
};

const byWorkspace = (
  pools: readonly OfferedPool[],
): ReadonlyMap<string, readonly OfferedPool[]> => {
  const grouped = new Map<string, OfferedPool[]>();

  for (const pool of pools) {
    const inWorkspace = grouped.get(pool.workspaceId.value) ?? [];
    inWorkspace.push(pool);
    grouped.set(pool.workspaceId.value, inWorkspace);
  }

  for (const group of grouped.values()) {
    group.sort(offerOrder);
  }

  return grouped;
};

const unique = (
  workspaceIds: readonly WorkspaceId[],
): readonly WorkspaceId[] => [
  ...new Map(workspaceIds.map((each) => [each.value, each])).values(),
];

export class ProvisionWork {
  readonly #noted = new OncePer(NOTED_FOR_MS);

  constructor(
    private readonly runs: RunRepository,
    private readonly reviewWork: ReviewWorkProvisioningPort,
    private readonly pools: RunnerPoolsPort,
    private readonly runners: RunnersPort,
    private readonly sandboxes: SandboxesPort,
    private readonly failures: ProvisionFailures,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async due(): Promise<void> {
    await this.expired();

    const offered = (
      await this.pools.provisioning(await this.pendingWorkspaces())
    ).map((each): OfferedPool => ({ ...each, pool: PoolId.of(each.poolId) }));

    await awaitAll(
      [...byWorkspace(offered).values()].map((pools) =>
        this.inWorkspace(pools),
      ),
    );
  }

  // Every workspace can have the platform pool, so the tick visits only the workspaces with work that waits.
  private async pendingWorkspaces(): Promise<readonly WorkspaceId[]> {
    const [runs, reviewWork] = await Promise.all([
      this.runs.workspacesAwaitingProvision(this.clock.now()),
      this.reviewWork.workspacesAwaiting(),
    ]);

    return unique([...runs, ...reviewWork]);
  }

  private async inWorkspace(pools: readonly OfferedPool[]): Promise<void> {
    const [first] = pools;
    const provisioning = pools.filter((offered) => offered.provisions);

    if (!first || provisioning.length === 0) {
      return;
    }

    let room = PoolRoom.of(
      await Promise.all(
        provisioning.map(
          async (offered) =>
            [
              offered.pool,
              await this.pools.roomIn(offered.poolId, this.clock.now()),
            ] as const,
        ),
      ),
      provisioning
        .filter((offered) => offered.platform)
        .map((offered) => offered.pool),
    );
    const placed: {
      provisionable: Provisionable;
      fitting: readonly OfferedPool[];
    }[] = [];
    const place = (provisionable: Provisionable): void => {
      const fitting = poolChoiceFor(
        provisionable.placement,
        pools,
        room,
        provisionable.needsEgress,
      );
      const [chosen] = fitting;

      if (!chosen) {
        this.unplaced(provisionable, pools);
        return;
      }

      if (placed.length < MAX_AT_ONCE) {
        room = room.afterPlacing(chosen);
        placed.push({ provisionable, fitting });
      }
    };

    const held = await this.sandboxes.liveKeysIn(
      first.workspaceId.value,
      this.clock.now(),
    );

    const withEgress = provisioning.some((offered) => offered.egress);

    for (const page of [
      async (skip: number) => {
        const queued = await this.runs.awaitingProvision(
          first.workspaceId,
          this.clock.now(),
          {
            skip,
            max: PAGE,
            withSecrets: withEgress,
            avoiding: held.map((each) => WorkingCopyKey.parse(each)),
          },
        );

        return {
          read: queued.waiting.length,
          found: ClaimOrder.provisionable(
            queued,
            this.clock.now(),
            withEgress,
          ).map((run) => this.provisionableRun(run)),
        };
      },
      async (skip: number) => {
        const awaiting = await this.reviewWork.awaiting(
          first.workspaceId,
          this.clock.now(),
          { skip, max: PAGE },
        );

        return {
          read: awaiting.length,
          found: awaiting.map((waiting) =>
            this.provisionableReviewWork(waiting),
          ),
        };
      },
    ]) {
      for (
        let at = 0;
        at < MAX_PAGES && placed.length < MAX_AT_ONCE && room.readsPage(at);
        at++
      ) {
        const { read, found } = await page(at * PAGE);

        found.forEach(place);

        if (read < PAGE) {
          break;
        }
      }
    }

    await awaitAll(
      placed.map(async ({ provisionable, fitting }) => {
        const thrown: unknown[] = [];

        for (const [at, pool] of fitting.entries()) {
          try {
            if (
              (await provisionable.on(pool, at === fitting.length - 1)) !==
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

  private async expired(): Promise<void> {
    const now = this.clock.now();

    for (const run of await this.runs.withExpiredReservations(now)) {
      const { reservation } = run;

      if (reservation && run.reservationExpiredAt(now)) {
        await this.failures.failed(
          run.id,
          reservation.runner,
          ProvisionFailure.expired(reservation.until),
          now,
        );
      }
    }

    for (const expired of await this.reviewWork.expired(now)) {
      await this.reviewWork.failed(
        expired.work,
        expired.runner,
        ProvisionFailure.expired(expired.until),
        now,
      );
    }
  }

  private unplaced(
    provisionable: Provisionable,
    pools: readonly OfferedPool[],
  ): void {
    if (!this.#noted.due(provisionable.key, this.clock.now())) {
      return;
    }

    const matches = pools.some((offered) =>
      poolFits(provisionable.placement, offered, provisionable.needsEgress),
    );

    this.logger.info(
      {
        ...provisionable.ids,
        labels: provisionable.placement.requiredLabels,
        needsEgress: provisionable.needsEgress,
        reason: matches ? 'no-pool-has-room' : 'no-pool-matches',
      },
      'Did not provision a runner',
    );
  }

  private provisionableRun(queued: Run): Provisionable {
    return {
      key: `run:${queued.id.value}`,
      ids: {
        ...queued.tags.value,
        workspaceId: queued.workspaceId.value,
        runId: queued.id.value,
      },
      placement: queued.placement,
      needsEgress: queued.injectsSecrets,
      on: (pool, last) => this.runOn(queued, pool, last),
    };
  }

  private provisionableReviewWork(waiting: WaitingReviewWork): Provisionable {
    return {
      key: `${waiting.work.kind}:${waiting.work.id.value}`,
      ids: {
        runId: waiting.runId?.value,
        workKind: waiting.work.kind,
        workId: waiting.work.id.value,
      },
      placement: waiting.placement,
      needsEgress: false,
      on: (pool, last) => this.reviewWorkOn(waiting, pool, last),
    };
  }

  private async runOn(
    queued: Run,
    pool: OfferedPool,
    last: boolean,
  ): Promise<Provisioned> {
    const current = await this.runs.findById(queued.id);

    if (!current?.provisionableAt(this.clock.now(), pool.egress)) {
      return 'done';
    }

    const runnerId = RunnerId.of(this.ids.generate());
    const reserved = current.reservedFor(
      runnerId,
      pool.pool,
      this.clock.now(),
      pool.egress,
    );
    const { reservation } = reserved;

    if (!reservation) {
      return 'done';
    }

    try {
      await this.runs.save(reserved);
    } catch (error) {
      if (error instanceof RunVersionConflictError) {
        return 'done';
      }

      throw error;
    }

    return this.attempted(
      () =>
        this.provisioned(pool, runnerId, {
          work: { kind: 'run', id: reserved.id.value },
          tags: reserved.tags.value,
          placement: reserved.placement,
          needsEgress: reserved.injectsSecrets,
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

  private async reviewWorkOn(
    waiting: WaitingReviewWork,
    pool: OfferedPool,
    last: boolean,
  ): Promise<Provisioned> {
    const runnerId = RunnerId.of(this.ids.generate());
    const until = await this.reviewWork.reserve(
      waiting.work,
      runnerId,
      pool.pool,
      this.clock.now(),
    );

    if (!until) {
      return 'done';
    }

    return this.attempted(
      () =>
        this.provisioned(pool, runnerId, {
          work:
            waiting.work.kind === 'check'
              ? {
                  kind: 'check',
                  id: waiting.work.id.value,
                  runId: waiting.runId,
                }
              : { kind: 'diff', id: waiting.work.id.value },
          tags: {},
          placement: waiting.placement,
          needsEgress: false,
          claimBy: until,
        }),
      {
        failed: (failure) =>
          this.reviewWork.failed(
            waiting.work,
            runnerId,
            failure,
            this.clock.now(),
          ),
        unreserved: () => this.reviewWork.unreserve(waiting.work, runnerId),
      },
      last,
    );
  }

  private provisioned(
    pool: PoolAtWork,
    runnerId: RunnerId,
    reserved: {
      readonly work: WorkToProvision;
      readonly tags: Readonly<Record<string, string>>;
      readonly placement: RunnerPlacement;
      readonly needsEgress: boolean;
      readonly claimBy: Date;
    },
  ): Promise<ProvisionedRunner> {
    return this.runners.provision(
      {
        poolId: pool.poolId,
        runnerId,
        work: reserved.work,
        tags: reserved.tags,
        labels: reserved.placement.requiredLabels,
        image: reserved.placement.image?.value ?? null,
        needsEgress: reserved.needsEgress,
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
    const next = ProvisionPlan.after(provisioned.outcome, last);

    if (next === 'done') {
      return 'done';
    }

    if (next === 'record-failure' && provisioned.outcome === 'failed') {
      await then.failed(
        ProvisionFailure.of(provisioned.kind, provisioned.detail),
      );
      return 'done';
    }

    await then.unreserved();
    return 'try-another';
  }
}
