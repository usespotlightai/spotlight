import type { ProvisionCallsPort } from '@runners/application/ports/provision-calls.port';
import type { AdmittedWay } from '@runners/application/ports/runner-admissions.port';
import type {
  HeldWork,
  ProvisionedRunner,
  ProvisionRequest,
  RunnersPort,
  StartedRunner,
} from '@runners/application/ports/runners.port';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

type Began =
  | { readonly outcome: 'began'; readonly through: RunnerPool | RunnerTrust }
  | { readonly outcome: 'full' }
  | { readonly outcome: 'gone' };

export class Runners implements RunnersPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly runners: RunnerRepository,
    private readonly calls: ProvisionCallsPort,
    private readonly tokens: TokenMintPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async reports(way: AdmittedWay, host: string): Promise<boolean> {
    let hostId: HostId;

    try {
      hostId = HostId.of(host);
    } catch {
      return false;
    }

    const serving = await this.hosts.find(hostId);

    return serving?.servesThrough(Admission.of(way.kind, way.id)) ?? false;
  }

  async start(
    way: AdmittedWay,
    host: string,
    image: string,
    at: Date,
    claimBy: Date,
  ): Promise<StartedRunner> {
    const hostId = HostId.of(host);
    const serving = await this.hosts.find(hostId);

    if (!serving?.servesThrough(Admission.of(way.kind, way.id))) {
      return { outcome: 'stranger' };
    }

    const offered = serving.offering(RunnerImage.of(image));

    if (!offered) {
      return { outcome: 'unoffered' };
    }

    const runnerId = RunnerId.of(this.ids.generate());
    const minted = this.tokens.mint();
    const egress = this.tokens.mint();
    const began = await this.began(way, 'pull', at, (through) =>
      Runner.started({
        id: runnerId,
        through,
        host: hostId,
        tokenHash: TokenHash.of(minted.hash),
        egressTokenHash: TokenHash.of(egress.hash),
        installed: offered.harnesses,
        running: offered.running,
        at,
        claimBy,
      }),
    );

    return began.outcome === 'began'
      ? {
          outcome: 'started',
          runnerId,
          token: minted.token,
          egressToken: egress.token,
        }
      : began;
  }

  async provision(
    request: ProvisionRequest,
    at: Date,
  ): Promise<ProvisionedRunner> {
    const minted = this.tokens.mint();
    let began: Began;

    try {
      began = await this.began(
        { kind: 'pool', id: request.poolId },
        'push',
        at,
        (through) =>
          Runner.started({
            id: request.runnerId,
            through,
            host: null,
            tokenHash: TokenHash.of(minted.hash),
            egressTokenHash: null,
            installed: [],
            running: null,
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

    const pool = began.through;
    const provision = pool instanceof RunnerPool ? pool.provision : null;

    if (!(pool instanceof RunnerPool) || !provision?.secret) {
      return { outcome: 'gone' };
    }

    const answer = await this.calls.call({
      url: provision.url,
      secret: provision.secret,
      attempt: request.runnerId.value,
      at,
      pool: pool.key.value,
      workspaceId: pool.workspaceId.value,
      kind: request.work.kind,
      stackId: request.work.kind === 'check' ? request.work.id : null,
      runId: request.runId,
      taskId: request.taskId,
      labels: request.labels,
      image: request.image,
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
    await reviseRunner(this.runners, runnerId, (runner) =>
      runner.took(RunnerWork.of(work.kind, work.id), at),
    );
  }

  async letGo(runnerId: RunnerId, at: Date): Promise<void> {
    await reviseRunner(this.runners, runnerId, (runner) => runner.letGo(at));
  }

  async workEnded(work: HeldWork, at: Date): Promise<void> {
    for (const holding of await this.runners.holding(
      RunnerWork.of(work.kind, work.id),
    )) {
      await reviseRunner(this.runners, holding.id, (runner) =>
        runner.ended(at),
      );
    }
  }

  private began(
    way: AdmittedWay,
    mode: RunnerPool['mode'],
    at: Date,
    starting: (through: RunnerPool | RunnerTrust) => Runner,
  ): Promise<Began> {
    return this.transaction.run(async () => {
      if (way.kind === 'trust') {
        const trust = await this.trusts.find(RunnerTrustId.of(way.id));

        if (!trust || trust.isWithdrawn || mode !== 'pull') {
          return { outcome: 'gone' };
        }

        await this.runners.add(starting(trust));

        return { outcome: 'began', through: trust };
      }

      const pool = await this.pools.findForStart(RunnerPoolId.of(way.id));

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

      return { outcome: 'began', through: pool };
    });
  }
}
