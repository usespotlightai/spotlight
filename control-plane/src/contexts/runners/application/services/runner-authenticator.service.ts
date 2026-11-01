import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type {
  AuthenticatedHost,
  HostCredentials,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { WorkloadTokensPort } from '@shared-kernel/application/ports/workload-tokens.port';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class RunnerAuthenticator implements RunnerAuthenticatorPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly workloads: WorkloadTokensPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly tokens: TokenIssuer,
    private readonly scope: WorkspaceOutboundScopePort,
  ) {}

  async authenticate(
    credential: HostCredentials,
  ): Promise<AuthenticatedHost | null> {
    const holder = await this.holderOf(credential);

    if (!holder) {
      return null;
    }

    const { kind, id } = CredentialSource.ofId(holder.id);

    return { source: { kind, id }, workspaceId: holder.workspaceId };
  }

  private async holderOf(
    credential: HostCredentials,
  ): Promise<RunnerPool | RunnerTrust | null> {
    const { bearer, trust } = credential;

    if (!bearer) {
      return null;
    }

    return trust?.trim() ? this.trusted(trust, bearer) : this.pooled(bearer);
  }

  private async pooled(token: string): Promise<RunnerPool | null> {
    const pool = await this.pools.findByTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );

    return pool?.mode === 'pull' &&
      !pool.isDeleted &&
      (await this.workspaces.isOpen(pool.workspaceId.value))
      ? pool
      : null;
  }

  private async trusted(
    trustId: string,
    token: string,
  ): Promise<RunnerTrust | null> {
    const trust = await this.trusts.find(RunnerTrustId.of(trustId));

    if (!trust || !(await this.workspaces.isOpen(trust.workspaceId.value))) {
      return null;
    }

    const claims = await this.scope.within(trust.workspaceId.value, () =>
      this.workloads.verify(token, {
        issuer: trust.workload.issuer,
        audience: trust.workload.audience,
      }),
    );

    return claims && trust.matches(claims) ? trust : null;
  }
}
