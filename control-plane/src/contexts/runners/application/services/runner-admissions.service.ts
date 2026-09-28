import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type {
  AdmittedHost,
  HostCredential,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { WorkloadTokensPort } from '@shared-kernel/application/ports/workload-tokens.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class RunnerAdmissions implements RunnerAdmissionsPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly workloads: WorkloadTokensPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly tokens: TokenMintPort,
  ) {}

  async admit(credential: HostCredential): Promise<AdmittedHost | null> {
    const admitted = await this.through(credential);

    if (!admitted) {
      return null;
    }

    const { kind, id } = Admission.through(admitted.id);

    return { way: { kind, id }, workspaceId: admitted.workspaceId };
  }

  private async through(
    credential: HostCredential,
  ): Promise<RunnerPool | RunnerTrust | null> {
    const { bearer, trust } = credential;

    if (!bearer) {
      return null;
    }

    const admitted = trust?.trim()
      ? await this.trusted(trust, bearer)
      : await this.pooled(bearer);

    return admitted &&
      (await this.workspaces.isOpen(admitted.workspaceId.value))
      ? admitted
      : null;
  }

  private async pooled(token: string): Promise<RunnerPool | null> {
    const pool = await this.pools.findByTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );

    return pool?.mode === 'pull' && !pool.isRetired ? pool : null;
  }

  private async trusted(
    trustId: string,
    token: string,
  ): Promise<RunnerTrust | null> {
    const trust = await this.trusts.find(RunnerTrustId.of(trustId));

    if (!trust) {
      return null;
    }

    const claims = await this.workloads.verify(token, {
      issuer: trust.workload.issuer,
      audience: trust.workload.audience,
    });

    return claims && trust.admits(claims) ? trust : null;
  }
}
