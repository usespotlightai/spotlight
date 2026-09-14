import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export const REPOSITORY_CONTENTS = Symbol('REPOSITORY_CONTENTS');

export interface RepositoryFile {
  readonly path: string;
  readonly text: string;
}

export interface Reading {
  readonly installation: GitHubInstallation;
  readonly repository: Repository;
  readonly ref: string;
  readonly path: string;
}

export interface RepositoryContentsPort {
  headOf(
    installation: GitHubInstallation,
    repository: Repository,
  ): Promise<string | null>;

  read(reading: Reading): Promise<RepositoryFile | null>;

  under(reading: Reading): Promise<readonly RepositoryFile[]>;
}
