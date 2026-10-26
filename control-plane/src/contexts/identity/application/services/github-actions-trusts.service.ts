import { TrustKeyTakenError } from '@identity/application/errors/trust-key-taken.error';
import { TrustsNeedAnAdminError } from '@identity/application/errors/trusts-need-an-admin.error';
import { UnsafeBranchNameError } from '@identity/application/errors/unsafe-branch-name.error';
import type {
  GitHubActionsTrustsDto,
  GitHubActionsTrustsPort,
  GitHubActionsTrustsWanted,
  TrustedWorkloadDto,
} from '@identity/application/ports/github-actions-trusts.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  OidcTrust,
  type OidcTrustSpec,
} from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const GITHUB_ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com';

const PULL_REQUESTS_TRUST_KEY = 'github-pull-requests';

const DEFAULT_BRANCH_TRUST_KEY = 'github-apply';

const SETUP_SUBJECTS: Readonly<Record<string, RegExp>> = {
  [PULL_REQUESTS_TRUST_KEY]: /^repo:[^/:*]+\/[^/:*]+:pull_request$/,
  [DEFAULT_BRANCH_TRUST_KEY]: /^repo:[^/:*]+\/[^/:*]+:ref:refs\/heads\/[^:*]+$/,
};

const PINNED_CLAIMS = ['repository_id', 'repository_owner_id'];

const setUpBefore = (trust: OidcTrust): boolean =>
  trust.workload.issuer === GITHUB_ACTIONS_ISSUER &&
  Object.keys(trust.workload.claims).every((claim) =>
    PINNED_CLAIMS.includes(claim),
  ) &&
  (SETUP_SUBJECTS[trust.key.value]?.test(trust.workload.subject.value) ??
    false);

export class GitHubActionsTrusts implements GitHubActionsTrustsPort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly trusts: OidcTrustRepository,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
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

    if (/[*:]/.test(wanted.defaultBranch)) {
      throw new UnsafeBranchNameError(wanted.defaultBranch);
    }

    const repository = Repository.of(wanted.repository);
    const by = ChangeActor.of(
      Actor.of(principal, Client.named(wanted.client)),
      workspaceId,
    );
    const ceiling = ScopeCeiling.of(principal);

    const claims = {
      repository_id: wanted.repositoryId,
      repository_owner_id: wanted.ownerId,
    };

    return this.transaction.inTransaction(async () => ({
      pullRequests: await this.kept(
        workspaceId,
        this.spec(
          PULL_REQUESTS_TRUST_KEY,
          `repo:${repository.value}:pull_request`,
          claims,
          ['plan'],
          TokenLifetime.USUAL_MINUTES,
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
          claims,
          wanted.applyScopes,
          TokenLifetime.LONGEST_MINUTES,
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
    claims: Readonly<Record<string, string>>,
    scopes: readonly string[],
    minutes: number,
  ): OidcTrustSpec {
    return {
      key: OidcTrustKey.of(key),
      workload: WorkloadRule.of({
        issuer: GITHUB_ACTIONS_ISSUER,
        audience: 'spotlight',
        subject,
        claims,
      }),
      scopes: TokenScopes.named(scopes),
      lifetime: TokenLifetime.ofMinutes(minutes),
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

    if (existing && !setUpBefore(existing)) {
      throw new TrustKeyTakenError(
        existing.key.value,
        existing.workload.subject.value,
      );
    }

    if (existing) {
      if (!spec.workload.equals(existing.workload)) {
        await this.trusts.save(
          existing.update(
            {
              ...spec,
              scopes: existing.scopes,
              lifetime: existing.lifetime,
            },
            ceiling,
            by,
          ),
        );
      }

      return { id: existing.id.value, key: existing.key.value };
    }

    const created = OidcTrust.create({
      ...spec,
      id: OidcTrustId.of(this.ids.generate()),
      workspaceId,
      createdBy,
      scopeCeiling: ceiling,
      by,
      now: this.clock.now(),
    });

    await this.trusts.add(created);

    return { id: created.id.value, key: created.key.value };
  }
}
