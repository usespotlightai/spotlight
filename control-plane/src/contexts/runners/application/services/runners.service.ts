import { MIN_HOST_RELEASE } from '@runners/application/contracts/least-host-release.contract';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type {
  ProvisionAnswer,
  ProvisionCallsPort,
  ProvisionEgress,
} from '@runners/application/ports/provision-calls.port';
import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import type { CredentialSourceRef } from '@runners/application/ports/runner-authenticator.port';
import type {
  LeasedWork,
  ProvisionedRunner,
  ProvisionRequest,
  RunnersPort,
  StartedRunner,
} from '@runners/application/ports/runners.port';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { ProvisionSecretDecryptionFailedError } from '@runners/domain/exceptions/provision-secret-decryption-failed.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { allowsUrl } from '@runners/domain/services/allows-url';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { PoolMode } from '@runners/domain/value-objects/pool-access.vo';
import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type {
  NewToken,
  TokenIssuer,
} from '@shared-kernel/application/ports/token-issuer.port';
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

type Unusable = { readonly outcome: 'unusable'; readonly detail: string };

type Answered = ProvisionAnswer | Unusable;

type ResolvedEgress =
  | { readonly outcome: 'found'; readonly url: EgressUrl | null }
  | Unusable;

export interface RunnersSettings {
  readonly insecureAllowed: boolean;
  readonly platformEgress: PlatformEgressSettings | null;
}

export class Runners implements RunnersPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly runners: RunnerRepository,
    private readonly egresses: EgressRepository,
    private readonly calls: ProvisionCallsPort,
    private readonly secrets: ProvisionSecretsPort,
    private readonly settings: RunnersSettings,
    private readonly tokens: TokenIssuer,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async reports(source: CredentialSourceRef, host: string): Promise<boolean> {
    let hostId: HostId;

    try {
      hostId = HostId.of(host);
    } catch {
      return false;
    }

    const known = await this.hosts.find(hostId);

    return (
      known?.hasSource(CredentialSource.of(source.kind, source.id)) ?? false
    );
  }

  private refused(
    source: CredentialSourceRef,
    host: string,
    reason: 'host-unreported' | 'host-outdated' | 'image-unreported',
  ): void {
    this.logger.warn(
      { source: source.kind, sourceId: source.id, host, reason },
      'Refused to start a runner',
    );
  }

  async start(
    source: CredentialSourceRef,
    host: string,
    image: string,
    at: Date,
    claimBy: Date,
  ): Promise<StartedRunner> {
    const hostId = HostId.of(host);
    const known = await this.hosts.find(hostId);

    if (!known?.hasSource(CredentialSource.of(source.kind, source.id))) {
      this.refused(source, host, 'host-unreported');
      return { outcome: 'host-unreported' };
    }

    if (known.isOlderThan(MIN_HOST_RELEASE)) {
      this.refused(source, host, 'host-outdated');
      return {
        outcome: 'host-outdated',
        release: known.report.release,
        minimum: MIN_HOST_RELEASE,
      };
    }

    const supported = known.supportedImage(RunnerImage.of(image));

    if (!supported) {
      this.refused(source, host, 'image-unreported');
      return { outcome: 'image-unreported' };
    }

    const runnerId = RunnerId.of(this.ids.generate());
    const issued = this.tokens.issue();
    const egress = this.tokens.issue();
    const starting: Starting = (through) =>
      Runner.start({
        id: runnerId,
        through,
        host: hostId,
        tokenHash: TokenHash.of(issued.hash),
        egressTokenHash: TokenHash.of(egress.hash),
        proxyCredentialHash: null,
        installed: supported.harnesses,
        running: supported.running,
        at,
        claimBy,
      });
    const began =
      source.kind === 'trust'
        ? await this.beganThroughTrust(
            RunnerTrustId.of(source.id),
            'pull',
            starting,
          )
        : await this.beganThroughPool(
            RunnerPoolId.of(source.id),
            'pull',
            at,
            starting,
          );

    return began.outcome === 'began'
      ? {
          outcome: 'started',
          runnerId,
          token: issued.token,
          egressToken: egress.token,
        }
      : began;
  }

  async provision(
    request: ProvisionRequest,
    at: Date,
  ): Promise<ProvisionedRunner> {
    const issued = this.tokens.issue();
    let credential: NewToken | null = null;
    const began = await this.beganThroughPool(
      RunnerPoolId.of(request.poolId),
      'push',
      at,
      (through) => {
        credential = through.egress ? this.tokens.issue() : null;

        return Runner.start({
          id: request.runnerId,
          through,
          host: null,
          tokenHash: TokenHash.of(issued.hash),
          egressTokenHash: null,
          proxyCredentialHash: credential
            ? TokenHash.of(credential.hash)
            : null,
          installed: [],
          running: null,
          at,
          claimBy: request.claimBy,
        });
      },
    );

    if (began.outcome !== 'began') {
      return began;
    }

    if (request.needsEgress && !began.through.egress) {
      await this.release(request.runnerId, at);

      return {
        outcome: 'failed',
        kind: 'unusable',
        detail:
          'The pool names no egress now. A run that uses secrets or the Spotlight API needs one.',
      };
    }

    const answer = await this.called(
      began.through,
      request,
      issued.token,
      credential,
      at,
    );

    if (answer.outcome === 'accepted') {
      return { outcome: 'provisioned' };
    }

    await this.release(request.runnerId, at).catch((error: unknown) => {
      this.logger.error(
        { err: error, runner: request.runnerId.value },
        'Releasing a runner whose provision call failed',
      );
    });

    return { outcome: 'failed', kind: answer.outcome, detail: answer.detail };
  }

  async claim(runnerId: RunnerId, work: LeasedWork, at: Date): Promise<void> {
    await reviseRunner(this.runners, runnerId, (runner) =>
      runner.claim(RunnerWork.of(work.kind, work.id), at),
    );
  }

  async release(runnerId: RunnerId, at: Date): Promise<void> {
    await reviseRunner(this.runners, runnerId, (runner) => runner.release(at));
  }

  async reservationDropped(runnerId: RunnerId, at: Date): Promise<void> {
    await reviseRunner(this.runners, runnerId, (runner) =>
      runner.reservationDropped(at),
    );
  }

  async workEnded(work: LeasedWork, at: Date): Promise<void> {
    for (const leasing of await this.runners.findByWork(
      RunnerWork.of(work.kind, work.id),
    )) {
      await reviseRunner(this.runners, leasing.id, (runner) =>
        runner.ended(at),
      );
    }
  }

  private async called(
    pool: RunnerPool,
    request: ProvisionRequest,
    token: string,
    credential: NewToken | null,
    at: Date,
  ): Promise<Answered> {
    const access = pool.provision;

    if (!access) {
      throw new InconsistentStateError(
        'runner pool',
        'was started for provisioning while it is pulled from',
      );
    }

    if (!allowsUrl(access.url, this.settings.insecureAllowed)) {
      return {
        outcome: 'not-allowed',
        detail: 'Provision URL must be https. Its calls carry a one-run token.',
      };
    }

    const resolved = await this.resolveEgress(pool, access.egress);

    if (resolved.outcome !== 'found') {
      return resolved;
    }

    if (
      resolved.url &&
      !allowsUrl(resolved.url, this.settings.insecureAllowed)
    ) {
      return {
        outcome: 'not-allowed',
        detail:
          'Egress URL must be https. Runners send their proxy credential to it.',
      };
    }

    const egress: ProvisionEgress | null =
      resolved.url && credential
        ? {
            url: resolved.url.value,
            credential: credential.token,
            traffic: pool.egressTraffic.value,
          }
        : null;

    if (resolved.url && !egress) {
      throw new InconsistentStateError(
        'runner',
        'was started for an egress with no proxy credential',
      );
    }

    let secret: ProvisionSecret;

    try {
      secret = await this.secrets.decrypt(pool, access.secret);
    } catch (error) {
      if (error instanceof ProvisionSecretDecryptionFailedError) {
        return {
          outcome: 'unusable',
          detail:
            'Cannot decrypt the provision secret with the keys of this deployment.',
        };
      }

      throw error;
    }

    return this.calls.call({
      url: access.url,
      secret,
      messageId: request.runnerId.value,
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
      egress,
    });
  }

  private async resolveEgress(
    pool: RunnerPool,
    reference: EgressReference | null,
  ): Promise<ResolvedEgress> {
    if (!reference) {
      return { outcome: 'found', url: null };
    }

    if (!reference.egressId) {
      const platform = this.settings.platformEgress;

      return platform
        ? { outcome: 'found', url: platform.url }
        : {
            outcome: 'unusable',
            detail:
              'Runner pool names the platform egress. This deployment has no platform egress.',
          };
    }

    const named = await this.egresses.find(reference.egressId);

    return named && !named.isDeleted && named.belongsTo(pool.workspaceId)
      ? { outcome: 'found', url: named.url }
      : {
          outcome: 'unusable',
          detail: `Runner pool names egress ${reference.value}. This egress doesn’t exist in the pool’s workspace.`,
        };
  }

  private beganThroughTrust(
    id: RunnerTrustId,
    mode: PoolMode,
    starting: Starting,
  ): Promise<Began<RunnerTrust>> {
    return this.transaction.inTransaction(async () => {
      const trust = await this.trusts.find(id);

      if (trust?.capacity(mode) !== 'open') {
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
    starting: (through: RunnerPool) => Runner,
  ): Promise<Began<RunnerPool>> {
    return this.transaction.inTransaction(async () => {
      const pool = await this.pools.findForStart(id);

      if (!pool) {
        return { outcome: 'gone' };
      }

      const alive = await this.runners.aliveIn(pool.id, at);
      const capacity = pool.capacity(mode, alive.length);

      if (capacity !== 'open') {
        return { outcome: capacity };
      }

      await this.runners.add(starting(pool));

      return { outcome: 'began', through: pool };
    });
  }
}
