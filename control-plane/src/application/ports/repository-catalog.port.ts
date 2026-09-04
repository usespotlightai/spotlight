import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface RepositorySummary {
  readonly fullName: string;
}

export const REPOSITORY_CATALOG = Symbol('REPOSITORY_CATALOG');

export interface RepositoryCatalogPort {
  list(installation: GitHubInstallation): Promise<RepositorySummary[]>;

  /**
   * Makes one that is not there yet, with a first commit in it: a repository
   * with no branch has no head to write against, and configuration written
   * into nothing is written nowhere.
   *
   * False where the host would not make it, which is its answer to give.
   */
  create(
    installation: GitHubInstallation,
    repository: Repository,
  ): Promise<boolean>;
}
