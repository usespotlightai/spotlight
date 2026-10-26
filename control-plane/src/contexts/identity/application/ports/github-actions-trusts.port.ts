export const GITHUB_ACTIONS_TRUSTS = Symbol('GITHUB_ACTIONS_TRUSTS');

export interface GitHubActionsTrustsWanted {
  readonly workspaceId: string;
  readonly by: string;
  readonly client: string;
  readonly repository: string;
  readonly repositoryId: string;
  readonly ownerId: string;
  readonly defaultBranch: string;
  readonly applyScopes: readonly string[];
}

export interface TrustedWorkloadDto {
  readonly id: string;
  readonly key: string;
}

export interface GitHubActionsTrustsDto {
  readonly pullRequests: TrustedWorkloadDto;
  readonly defaultBranch: TrustedWorkloadDto;
}

export interface GitHubActionsTrustsPort {
  trust(wanted: GitHubActionsTrustsWanted): Promise<GitHubActionsTrustsDto>;
}
