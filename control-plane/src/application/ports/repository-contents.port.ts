import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export const REPOSITORY_CONTENTS = Symbol('REPOSITORY_CONTENTS');

/** One file as the repository holds it, at the commit that was asked for. */
export interface RepositoryFile {
  /** From the root of the repository, however it was asked for. */
  readonly path: string;
  readonly text: string;
}

export interface Reading {
  readonly installation: GitHubInstallation;
  readonly repository: Repository;
  /** A branch, a tag, or a commit. What was read is fixed by whatever this is. */
  readonly ref: string;
  readonly path: string;
}

/**
 * Reading a repository without cloning it. Spotlight reads configuration this
 * way rather than through a runner, because a workspace's configuration has
 * to be readable before there is any run to read it from.
 *
 * Nothing here writes. What a person may change is changed the way anything
 * else in the repository is: on a branch, in a pull request.
 */
export interface RepositoryContentsPort {
  /**
   * The commit the default branch stands at. Configuration is read at a
   * commit rather than a branch, so what was read is a fact afterwards.
   */
  headOf(
    installation: GitHubInstallation,
    repository: Repository,
  ): Promise<string | null>;

  /** One file, or nothing where the repository holds none at that path. */
  read(reading: Reading): Promise<RepositoryFile | null>;

  /**
   * Every file beneath a directory, however deep, in a stable order. A
   * directory that is not there reads as no files rather than as an error:
   * a repository without configuration is the ordinary case.
   */
  under(reading: Reading): Promise<readonly RepositoryFile[]>;
}
