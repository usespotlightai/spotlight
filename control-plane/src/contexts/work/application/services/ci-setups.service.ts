import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type { GitHubActionsTrustsPort } from '@identity/application/ports/github-actions-trusts.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CiSetup } from '@work/domain/value-objects/ci-setup.vo';

const CI_APPLY_SCOPES = ['configure', 'secrets', 'runners'] as const;

export const CI_VARIABLES = {
  url: 'SPOTLIGHT_URL',
  planTrust: 'SPOTLIGHT_PLAN_TRUST',
  applyTrust: 'SPOTLIGHT_APPLY_TRUST',
} as const;

export class CiSetups {
  constructor(
    private readonly settings: RepositorySettingsPort,
    private readonly trusts: GitHubActionsTrustsPort,
    private readonly publicUrl: string,
  ) {}

  async setUp(
    workspaceId: WorkspaceId,
    by: UserId,
    repository: Repository,
  ): Promise<CiSetup> {
    const [branch, subjectPrefix] = await Promise.all([
      this.settings.defaultBranchOf(workspaceId, repository),
      this.settings.oidcSubjectPrefixOf(workspaceId, repository),
    ]);
    const trusted = await this.trusts.trust({
      workspaceId: workspaceId.value,
      by: by.value,
      client: 'web',
      subjectPrefix,
      repositoryId: branch.repositoryId,
      ownerId: branch.ownerId,
      defaultBranch: branch.name,
      applyScopes: CI_APPLY_SCOPES,
    });
    const variables = await this.settings.putVariables(
      workspaceId,
      repository,
      {
        [CI_VARIABLES.url]: this.publicUrl,
        [CI_VARIABLES.planTrust]: trusted.pullRequests.id,
        [CI_VARIABLES.applyTrust]: trusted.defaultBranch.id,
      },
    );

    return CiSetup.of({
      defaultBranch: branch.name,
      defaultBranchProtected: branch.protected,
      pullRequestsTrustId: trusted.pullRequests.id,
      defaultBranchTrustId: trusted.defaultBranch.id,
      variables,
    });
  }
}
