import type {
  HeldWork,
  PoolRunnersPort,
  ProvisionedRunner,
  ProvisionRequest,
  ReportedHarness,
  StartedPoolRunner,
} from '@runners/application/ports/pool-runners.port';
import type { ProvisionCallsPort } from '@runners/application/ports/provision-calls.port';
import { revisePoolRunner } from '@runners/application/services/pool-runner-revisions';
import { PoolRunner } from '@runners/domain/aggregates/pool-runner.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { PoolWork } from '@runners/domain/value-objects/pool-work.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

type Began =
  | { readonly outcome: 'began'; readonly pool: RunnerPool }
  | { readonly outcome: 'full' }
  | { readonly outcome: 'gone' };

export class PoolRunners implements PoolRunnersPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly runners: PoolRunnerRepository,
    private readonly calls: ProvisionCallsPort,
    private readonly tokens: TokenMintPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async start(
    poolId: string,
    installed: readonly ReportedHarness[],
    at: Date,
    claimBy: Date,
  ): Promise<StartedPoolRunner> {
    const runnerId = RunnerId.of(this.ids.generate());
    const minted = this.tokens.mint();
    const began = await this.began(poolId, 'pull', at, (pool) =>
      PoolRunner.started({
        id: runnerId,
        pool,
        tokenHash: TokenHash.of(minted.hash),
        installed: installed.map((each) =>
          InstalledHarness.reported(each.id, each.models, each.version),
        ),
        at,
        claimBy,
      }),
    );

    return began.outcome === 'began'
      ? { outcome: 'started', runnerId, token: minted.token }
      : began;
  }

  async provision(
    request: ProvisionRequest,
    at: Date,
  ): Promise<ProvisionedRunner> {
    const minted = this.tokens.mint();
    let began: Began;

    try {
      began = await this.began(request.poolId, 'push', at, (pool) =>
        PoolRunner.started({
          id: request.runnerId,
          pool,
          tokenHash: TokenHash.of(minted.hash),
          installed: [],
          at,
          claimBy: request.claimBy,
        }),
      );
    } catch (error) {
      if (error instanceof ProvisionSecretUnopenableError) {
        return {
          outcome: 'failed',
          kind: 'unusable',
          detail:
            'the pool’s provision secret does not open with this deployment’s keys',
        };
      }

      throw error;
    }

    if (began.outcome !== 'began') {
      return began;
    }

    const { provision } = began.pool;

    if (!provision?.secret) {
      return { outcome: 'gone' };
    }

    const answer = await this.calls.call({
      url: provision.url,
      secret: provision.secret,
      attempt: request.runnerId.value,
      at,
      pool: began.pool.key.value,
      workspaceId: began.pool.workspaceId.value,
      kind: request.work.kind,
      stackId: request.work.kind === 'check' ? request.work.id : null,
      runId: request.runId,
      taskId: request.taskId,
      labels: request.labels,
      runnerId: request.runnerId.value,
      token: minted.token,
      claimBy: request.claimBy,
    });

    if (answer.outcome === 'accepted') {
      return { outcome: 'provisioned' };
    }

    await this.letGo(request.runnerId, at).catch((error: unknown) => {
      this.logger.error(
        { err: error, runner: request.runnerId.value },
        'Letting go of a runner its provision call refused',
      );
    });

    return { outcome: 'failed', kind: answer.outcome, detail: answer.detail };
  }

  async took(runnerId: RunnerId, work: HeldWork, at: Date): Promise<void> {
    await revisePoolRunner(this.runners, runnerId, (runner) =>
      runner.took(PoolWork.of(work.kind, work.id), at),
    );
  }

  async letGo(runnerId: RunnerId, at: Date): Promise<void> {
    await revisePoolRunner(this.runners, runnerId, (runner) =>
      runner.letGo(at),
    );
  }

  async workEnded(work: HeldWork, at: Date): Promise<void> {
    for (const holding of await this.runners.holding(
      PoolWork.of(work.kind, work.id),
    )) {
      await revisePoolRunner(this.runners, holding.id, (runner) =>
        runner.ended(at),
      );
    }
  }

  private began(
    poolId: string,
    mode: RunnerPool['mode'],
    at: Date,
    starting: (pool: RunnerPool) => PoolRunner,
  ): Promise<Began> {
    return this.transaction.run(async () => {
      const pool = await this.pools.findForStart(RunnerPoolId.of(poolId));

      if (
        !pool ||
        pool.mode !== mode ||
        (mode === 'push' && !pool.provision?.secret)
      ) {
        return { outcome: 'gone' };
      }

      const standing = await this.runners.standingIn(pool.id, at);

      if (!pool.hasRoomFor(standing.length)) {
        return { outcome: 'full' };
      }

      await this.runners.add(starting(pool));

      return { outcome: 'began', pool };
    });
  }
}
