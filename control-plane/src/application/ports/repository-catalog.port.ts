import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';

export interface RepositorySummary {
  readonly fullName: string;
}

export const REPOSITORY_CATALOG = Symbol('REPOSITORY_CATALOG');

export interface RepositoryCatalogPort {
  list(installation: GitHubInstallation): Promise<RepositorySummary[]>;
}
