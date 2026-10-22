import { TrustsNeedAnAdminError } from '@identity/application/errors/trusts-need-an-admin.error';
import type {
  GitHubActionsTrustsDto,
  GitHubActionsTrustsPort,
  GitHubActionsTrustsWanted,
  TrustedWorkloadDto,
} from '@identity/application/ports/github-actions-trusts.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  type OidcTrustSpec,
  OidcTrust,
} from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';

export const GITHUB_ACTIONS_ISSUER =
  'https://token.actions.githubusercontent.com';

export const PULL_REQUESTS_TRUST_KEY = 'github-pull-requests';

export const DEFAULT_BRANCH_TRUST_KEY = 'github-apply';

export class GitHubActionsTrusts implements GitHubActionsTrustsPort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly trusts: OidcTrustRepository,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async trust(
    wanted: GitHubActionsTrustsWanted,
  ): Promise<GitHubActionsTrustsDto> {
    const workspaceId = WorkspaceId.of(wanted.workspaceId);
    const principal = PersonPrincipal.of(UserId.of(wanted.by));
    const permissions = await this.access.permissionsIn(workspaceId, principal);

    if (!permissions?.managesOidcTrusts) {
      throw new TrustsNeedAnAdminError();
    }

    const repository = Repository.of(wanted.repository);
    const by = ChangeActor.of(
      Actor.of(principal, Client.named(wanted.client)),
      workspaceId,
    );
    const ceiling = ScopeCeiling.of(principal);

    return this.transaction.inTransaction(async () => ({
      pullRequests: await this.kept(
        workspaceId,
        this.spec(
          PULL_REQUESTS_TRUST_KEY,
          `repo:${repository.value}:pull_request`,
          ['plan'],
        ),
        principal.userId,
        ceiling,
        by,
      ),
      defaultBranch: await this.kept(
        workspaceId,
        this.spec(
          DEFAULT_BRANCH_TRUST_KEY,
          `repo:${repository.value}:ref:refs/heads/${wanted.defaultBranch}`,
          wanted.applyScopes,
        ),
        principal.userId,
        ceiling,
        by,
      ),
    }));
  }

  private spec(
    key: string,
    subject: string,
    scopes: readonly string[],
  ): OidcTrustSpec {
    return {
      key: OidcTrustKey.of(key),
      workload: WorkloadRule.of({
        issuer: GITHUB_ACTIONS_ISSUER,
        audience: 'spotlight',
        subject,
        claims: {},
      }),
      scopes: TokenScopes.named(scopes),
      lifetime: TokenLifetime.ofMinutes(TokenLifetime.USUAL_MINUTES),
    };
  }

  private async kept(
    workspaceId: WorkspaceId,
    spec: OidcTrustSpec,
    createdBy: UserId,
    ceiling: ScopeCeiling,
    by: ChangeActor,
  ): Promise<TrustedWorkloadDto> {
    const existing = await this.trusts.findByKey(workspaceId, spec.key);

    if (existing) {
      await this.trusts.save(existing.update(spec, ceiling, by));

      return { id: existing.id.value, key: existing.key.value };
    }

    const created = OidcTrust.create({
      ...spec,
      id: OidcTrustId.of(this.ids.generate()),
      workspaceId,
      createdBy,
      scopeCeiling: ceiling,
      by,
    });

    await this.trusts.add(created);

    return { id: created.id.value, key: created.key.value };
  }
}
