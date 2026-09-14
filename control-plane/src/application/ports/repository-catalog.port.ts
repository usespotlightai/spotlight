import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface RepositorySummary {
  readonly fullName: string;
}

export const REPOSITORY_CATALOG = Symbol('REPOSITORY_CATALOG');

export interface RepositoryCatalogPort {
  list(installation: GitHubInstallation): Promise<RepositorySummary[]>;

  create(
    installation: GitHubInstallation,
    repository: Repository,
  ): Promise<boolean>;
}
