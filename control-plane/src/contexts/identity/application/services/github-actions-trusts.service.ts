import { TrustsNeedAnAdminError } from '@identity/application/errors/trusts-need-an-admin.error';
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
import { GitHubActionsTrustTemplate } from '@identity/domain/services/github-actions-trust-template';
import { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Planned {
  readonly spec: OidcTrustSpec;
  readonly existing: OidcTrust | null;
  readonly adopted: OidcTrustSpec | null;
}

interface Keeping {
  readonly workspaceId: WorkspaceId;
  readonly createdBy: UserId;
  readonly ceiling: ScopeCeiling;
  readonly by: ChangeActor;
}

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

    if (!permissions?.scopes.has('trusts')) {
      throw new TrustsNeedAnAdminError();
    }

    const specs = GitHubActionsTrustTemplate.specsFor(wanted);
    const keeping: Keeping = {
      workspaceId,
      createdBy: principal.userId,
      ceiling: ScopeCeiling.of(principal),
      by: ChangeActor.of(
        Actor.of(principal, Client.named(wanted.client)),
        workspaceId,
      ),
    };

    const pullRequests = await this.planned(specs.pullRequests, keeping);
    const defaultBranch = await this.planned(specs.defaultBranch, keeping);

    return {
      pullRequests: await this.transaction.inTransaction(() =>
        this.kept(pullRequests, keeping),
      ),
      defaultBranch: await this.transaction.inTransaction(() =>
        this.kept(defaultBranch, keeping),
      ),
    };
  }

  private async planned(
    spec: OidcTrustSpec,
    keeping: Keeping,
  ): Promise<Planned> {
    const existing = await this.trusts.findByKey(keeping.workspaceId, spec.key);

    return existing
      ? {
          spec,
          existing,
          adopted: GitHubActionsTrustTemplate.adopted(existing, spec),
        }
      : { spec, existing: null, adopted: null };
  }

  private async kept(
    planned: Planned,
    keeping: Keeping,
  ): Promise<TrustedWorkloadDto> {
    const { spec, existing, adopted } = planned;

    if (existing) {
      if (adopted) {
        await this.trusts.save(
          existing.update(adopted, keeping.ceiling, keeping.by),
        );
      }

      return { id: existing.id.value, key: existing.key.value };
    }

    const created = OidcTrust.create({
      ...spec,
      id: OidcTrustId.of(this.ids.generate()),
      workspaceId: keeping.workspaceId,
      createdBy: keeping.createdBy,
      scopeCeiling: keeping.ceiling,
      by: keeping.by,
      now: this.clock.now(),
    });

    await this.trusts.add(created);

    return { id: created.id.value, key: created.key.value };
  }
}
