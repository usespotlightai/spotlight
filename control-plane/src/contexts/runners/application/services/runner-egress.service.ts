import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type {
  EgressAuthentication,
  RunnerEgressPort,
  SharedEgress,
  SharedEgressAuthentication,
} from '@runners/application/ports/runner-egress.port';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { sameHash } from '@runners/domain/services/same-hash';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerEgress implements RunnerEgressPort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly tokens: TokenIssuer,
    private readonly egresses: EgressRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly platform: PlatformEgressSettings | null,
  ) {}

  async authenticate(
    token: string | undefined,
    at: Date,
  ): Promise<EgressAuthentication | null> {
    if (!token) {
      return null;
    }

    const runner = await this.runners.findByEgressTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );
    const work = runner?.authenticateEgressToken(at);

    return runner && work
      ? {
          runnerId: runner.id.value,
          workspaceId: runner.workspaceId.value,
          work: { kind: work.kind, id: work.id },
        }
      : null;
  }

  async sharedWith(token: string | undefined): Promise<SharedEgress | null> {
    if (!token) {
      return null;
    }

    const hash = TokenHash.of(this.tokens.hash(token));

    if (this.platform && sameHash(this.platform.tokenHash, hash)) {
      return { egressId: EgressReference.platform().value };
    }

    const egress = await this.egresses.findByTokenHash(hash);

    return egress &&
      !egress.isDeleted &&
      (await this.workspaces.isOpen(egress.workspaceId.value))
      ? { egressId: egress.id.value }
      : null;
  }

  authorizeRunner(
    egress: SharedEgress,
    proxyCredential: string,
    at: Date,
  ): Promise<SharedEgressAuthentication | null> {
    return this.resolveRunner(egress, proxyCredential, (runner) =>
      runner.isAlive(at) ? { work: runner.work } : null,
    );
  }

  runnerForConnectionRecords(
    egress: SharedEgress,
    proxyCredential: string,
    at: Date,
  ): Promise<SharedEgressAuthentication | null> {
    return this.resolveRunner(egress, proxyCredential, (runner) => {
      const work = runner.workForConnectionRecords(at);

      return work ? { work } : null;
    });
  }

  private async resolveRunner(
    egress: SharedEgress,
    proxyCredential: string,
    workOf: (runner: Runner) => { work: RunnerWork | null } | null,
  ): Promise<SharedEgressAuthentication | null> {
    if (!proxyCredential) {
      return null;
    }

    const runner = await this.runners.findByProxyCredentialHash(
      TokenHash.of(this.tokens.hash(proxyCredential)),
    );
    const active = runner ? workOf(runner) : null;
    const poolId = active ? runner?.source.poolId : null;
    const pool = poolId ? await this.pools.find(poolId) : null;
    const through = EgressReference.of(egress.egressId);

    if (
      !runner ||
      !active ||
      !pool?.belongsTo(runner.workspaceId) ||
      !pool.usesEgress(through) ||
      !(await this.servesIn(through, runner.workspaceId))
    ) {
      return null;
    }

    const { work } = active;

    return {
      egressId: through.value,
      runnerId: runner.id.value,
      workspaceId: runner.workspaceId.value,
      work: work ? { kind: work.kind, id: work.id } : null,
    };
  }

  private async servesIn(
    through: EgressReference,
    workspaceId: WorkspaceId,
  ): Promise<boolean> {
    if (!through.egressId) {
      return this.platform !== null;
    }

    const named = await this.egresses.find(through.egressId);

    return named !== null && !named.isDeleted && named.belongsTo(workspaceId);
  }
}
