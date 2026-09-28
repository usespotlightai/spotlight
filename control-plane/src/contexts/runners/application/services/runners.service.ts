import type {
  ProvisionAnswer,
  ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';
import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
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
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { carriesRunTokens } from '@runners/domain/services/run-token-carriage';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { PoolMode } from '@runners/domain/value-objects/pool-access.vo';
import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

type Began<Through> =
  | { readonly outcome: 'began'; readonly through: Through }
  | { readonly outcome: 'full' }
  | { readonly outcome: 'gone' };

type Starting = (through: RunnerPool | RunnerTrust) => Runner;

type Answered =
  | ProvisionAnswer
  | { readonly outcome: 'unusable'; readonly detail: string };

export interface RunnersSettings {
  readonly insecureAllowed: boolean;
}

export class Runners implements RunnersPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly runners: RunnerRepository,
    private readonly calls: ProvisionCallsPort,
    private readonly secrets: ProvisionSecretsPort,
    private readonly settings: RunnersSettings,
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
    const starting: Starting = (through) =>
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
      });
    const began =
      way.kind === 'trust'
        ? await this.beganThroughTrust(
            RunnerTrustId.of(way.id),
            'pull',
            starting,
          )
        : await this.beganThroughPool(
            RunnerPoolId.of(way.id),
            'pull',
            at,
            starting,
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
    const began = await this.beganThroughPool(
      RunnerPoolId.of(request.poolId),
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

    if (began.outcome !== 'began') {
      return began;
    }

    const answer = await this.called(began.through, request, minted.token, at);

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

  async reservationDropped(runnerId: RunnerId, at: Date): Promise<void> {
    await reviseRunner(this.runners, runnerId, (runner) =>
      runner.reservationDropped(at),
    );
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

  private async called(
    pool: RunnerPool,
    request: ProvisionRequest,
    token: string,
    at: Date,
  ): Promise<Answered> {
    const access = pool.provision;

    if (!access) {
      throw new InconsistentStateError(
        'runner pool',
        'was started for provisioning while it is pulled from',
      );
    }

    if (!carriesRunTokens(access.url, this.settings.insecureAllowed)) {
      return {
        outcome: 'not-allowed',
        detail:
          'the provision URL is not https, and a one-run token is never sent in the clear',
      };
    }

    let secret: ProvisionSecret;

    try {
      secret = await this.secrets.opened(pool, access.secret);
    } catch (error) {
      if (error instanceof ProvisionSecretUnopenableError) {
        return {
          outcome: 'unusable',
          detail:
            'the pool’s provision secret does not open with this deployment’s keys',
        };
      }

      throw error;
    }

    return this.calls.call({
      url: access.url,
      secret,
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
      token,
      claimBy: request.claimBy,
    });
  }

  private beganThroughTrust(
    id: RunnerTrustId,
    mode: PoolMode,
    starting: Starting,
  ): Promise<Began<RunnerTrust>> {
    return this.transaction.run(async () => {
      const trust = await this.trusts.find(id);

      if (trust?.startVerdict(mode) !== 'open') {
        return { outcome: 'gone' };
      }

      await this.runners.add(starting(trust));

      return { outcome: 'began', through: trust };
    });
  }

  private beganThroughPool(
    id: RunnerPoolId,
    mode: PoolMode,
    at: Date,
    starting: Starting,
  ): Promise<Began<RunnerPool>> {
    return this.transaction.run(async () => {
      const pool = await this.pools.findForStart(id);

      if (!pool) {
        return { outcome: 'gone' };
      }

      const standing = await this.runners.standingIn(pool.id, at);
      const verdict = pool.startVerdict(mode, standing.length);

      if (verdict !== 'open') {
        return { outcome: verdict };
      }

      await this.runners.add(starting(pool));

      return { outcome: 'began', through: pool };
    });
  }
}
