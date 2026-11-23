import type {
  HostOfferAtWork,
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
  ReviewWorkCursor,
  ReviewWorkProvisioningPort,
  WaitingReviewWork,
} from '@runs/application/ports/review-work-provisioning.port';
import type {
  RunWaitsPort,
  WaitingRun,
} from '@runs/application/ports/run-waits.port';
import type { ProvisionFailures } from '@runs/application/services/provision-failures.service';
import { Sweeps } from '@runs/application/services/sweeps';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import {
  type ClaimCursor,
  ClaimOrder,
} from '@runs/domain/services/claim-order';
import {
  offerOrder,
  type PoolOnOffer,
  PoolRoom,
  poolChoiceFor,
  waitReasonFor,
} from '@runs/domain/services/pool-choice';
import type { WorkNeeds } from '@runs/domain/services/pool-fit';
import { ProvisionPlan } from '@runs/domain/services/provision-plan';
import type { WaitReason } from '@runs/domain/value-objects/run-waiting';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { OncePer } from '@shared-kernel/application/services/once-per';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
  readonly needs: WorkNeeds;
  readonly on: (pool: OfferedPool, last: boolean) => Promise<Provisioned>;
  // A run keeps why it waits, so that the person who ordered it can see it. Review work does not.
  readonly run: { readonly id: RunId; readonly queuedAt: Date } | null;
}

interface Read<Cursor> {
  readonly read: number;
  readonly found: readonly Provisionable[];
  readonly next: Cursor | null;
}

// One kind of waiting work: the runs, or the review work. A page starts at a cursor, and at the head with none.
interface Source<Cursor> {
  readonly sweeps: Sweeps<Cursor>;
  readonly page: (from: Cursor | null) => Promise<Read<Cursor>>;
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

const byWorkspace = <Each extends { readonly workspaceId: WorkspaceId }>(
  all: readonly Each[],
): ReadonlyMap<string, readonly Each[]> => {
  const grouped = new Map<string, Each[]>();

  for (const each of all) {
    const inWorkspace = grouped.get(each.workspaceId.value) ?? [];
    inWorkspace.push(each);
    grouped.set(each.workspaceId.value, inWorkspace);
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

  // Each tick reads the head and at most one page past it, for each kind of work.
  readonly #runSweeps = new Sweeps<ClaimCursor>(MAX_PAGES);

  readonly #reviewWorkSweeps = new Sweeps<ReviewWorkCursor>(MAX_PAGES);

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
    private readonly waits: RunWaitsPort,
  ) {}

  async due(): Promise<void> {
    await this.expired();

    const awaiting = await this.workspacesAwaiting();
    const waiting = new Set(awaiting.map((each) => each.value));

    this.#runSweeps.keepOnly(waiting);
    this.#reviewWorkSweeps.keepOnly(waiting);

    const offers = await this.pools.offersIn(awaiting);
    const offered = offers.pools;
    const hostsBy = byWorkspace(offers.hostOffers);

    await awaitAll(
      [
        ...byWorkspace(
          offered.map((each): OfferedPool => ({
            ...each,
            pool: PoolId.of(each.poolId),
          })),
        ).entries(),
      ].map(([workspaceId, pools]) =>
        this.inWorkspace(
          [...pools].sort(offerOrder),
          hostsBy.get(workspaceId) ?? [],
        ),
      ),
    );
  }

  // Every workspace can have the platform pool, so the tick visits only the workspaces with work that waits.
  private async workspacesAwaiting(): Promise<readonly WorkspaceId[]> {
    const [runs, reviewWork] = await Promise.all([
      this.runs.workspacesAwaitingProvision(this.clock.now()),
      this.reviewWork.workspacesAwaiting(this.clock.now()),
    ]);

    return unique([...runs, ...reviewWork]);
  }

  private async inWorkspace(
    pools: readonly OfferedPool[],
    hostOffers: readonly HostOfferAtWork[],
  ): Promise<void> {
    const [first] = pools;

    if (!first) {
      return;
    }

    let room = PoolRoom.of(
      await Promise.all(
        pools.map(
          async (offered) =>
            [
              offered.pool,
              await this.pools.roomIn(offered.poolId, this.clock.now()),
            ] as const,
        ),
      ),
    );
    const placed: {
      provisionable: Provisionable;
      fitting: readonly OfferedPool[];
    }[] = [];
    const seen = new Set<string>();
    const waiting: WaitingRun[] = [];
    const place = (provisionable: Provisionable): void => {
      if (seen.has(provisionable.key)) {
        return;
      }

      seen.add(provisionable.key);

      const fitting = poolChoiceFor(
        provisionable.placement,
        pools,
        hostOffers,
        room,
        provisionable.needs,
      );
      const [chosen] = fitting;

      if (!chosen) {
        const reason = waitReasonFor(
          provisionable.placement,
          pools,
          hostOffers,
          provisionable.needs,
        );

        this.unplaced(provisionable, reason);

        if (provisionable.run) {
          waiting.push({
            runId: provisionable.run.id,
            reason,
            queuedAt: provisionable.run.queuedAt,
          });
        }

        return;
      }

      if (placed.length < MAX_AT_ONCE) {
        room = room.afterTaking(chosen.pool);
        placed.push({ provisionable, fitting });
      }
    };
    const more = (): boolean => placed.length < MAX_AT_ONCE && room.anyLeft;

    const held = await this.sandboxes.liveKeysIn(
      first.workspaceId.value,
      this.clock.now(),
    );

    const withEgress = pools.some((offered) => offered.egress);

    await this.sweep(first.workspaceId, place, more, {
      sweeps: this.#runSweeps,
      page: async (from: ClaimCursor | null) => {
        const queued = await this.runs.awaitingProvision(
          first.workspaceId,
          this.clock.now(),
          {
            after: from,
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
          next: ClaimOrder.cursorAfter(queued.waiting),
        };
      },
    });
    await this.sweep(first.workspaceId, place, more, {
      sweeps: this.#reviewWorkSweeps,
      page: async (from: ReviewWorkCursor | null) => {
        const awaiting = await this.reviewWork.awaiting(
          first.workspaceId,
          this.clock.now(),
          { after: from, max: PAGE },
        );

        return {
          read: awaiting.waiting.length,
          found: awaiting.waiting.map((waiting) =>
            this.provisionableReviewWork(waiting),
          ),
          next: awaiting.next,
        };
      },
    });

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
    await this.waits.note(waiting, this.clock.now());
  }

  // Reads the head page, then one page past it from where the last tick stopped. The platform pool has no run limit, so room alone does not end the reading.
  private async sweep<Cursor>(
    workspaceId: WorkspaceId,
    place: (provisionable: Provisionable) => void,
    more: () => boolean,
    source: Source<Cursor>,
  ): Promise<void> {
    if (!more()) {
      return;
    }

    const at = workspaceId.value;
    const head = await source.page(null);

    head.found.forEach(place);

    if (head.read < PAGE || head.next === null) {
      source.sweeps.restart(at);
      return;
    }

    if (!more()) {
      return;
    }

    const { from, page } = source.sweeps.next(at, head.next);
    const past = await source.page(from);

    past.found.forEach(place);
    source.sweeps.read(at, page, {
      full: past.read === PAGE,
      next: past.next,
    });
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

  // The log is throttled for each piece of work. The wait itself is noted at each tick.
  private unplaced(provisionable: Provisionable, reason: WaitReason): void {
    if (!this.#noted.due(provisionable.key, this.clock.now())) {
      return;
    }

    this.logger.info(
      {
        ...provisionable.ids,
        labels: provisionable.placement.requiredLabels,
        needs: provisionable.needs,
        reason,
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
      needs: { secrets: queued.injectsSecrets, reviewWork: false },
      on: (pool, last) => this.runOn(queued, pool, last),
      run: { id: queued.id, queuedAt: queued.queuedAt },
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
      needs: { secrets: false, reviewWork: true },
      on: (pool, last) => this.reviewWorkOn(waiting, pool, last),
      run: null,
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
