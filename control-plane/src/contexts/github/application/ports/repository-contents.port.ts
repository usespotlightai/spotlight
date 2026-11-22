import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RepositoryFileDto {
  readonly content: string;
  readonly blobSha: string;
  readonly commit: string;
  readonly defaultBranch: string;
}

export interface RepositoryFileContent {
  readonly path: string;
  readonly content: string;
}

export interface RepositoryCommit {
  readonly branch: string;
  readonly base: string;
  readonly replacing: string | null;
  readonly message: string;
  readonly files: readonly RepositoryFileContent[];
}

export interface TopFiles {
  readonly ref: string;
  readonly files: readonly RepositoryFileContent[];
}

export const REPOSITORY_CONTENTS = Symbol('REPOSITORY_CONTENTS');

export interface RepositoryContentsPort {
  fileAt(
    workspaceId: WorkspaceId,
    repository: Repository,
    path: string,
    ref?: string,
  ): Promise<RepositoryFileDto | null>;

  filesUnder(
    workspaceId: WorkspaceId,
    repository: Repository,
    directory: string,
    ref: string,
  ): Promise<readonly RepositoryFileContent[]>;

  /**
   * Reads the files of these names at the top of the repository, at ref or, where ref is null or not there yet,
   * at the default branch. It names the ref it read.
   */
  topFiles(
    workspaceId: WorkspaceId,
    repository: Repository,
    names: readonly string[],
    ref: string | null,
  ): Promise<TopFiles>;

  pathsAt(
    workspaceId: WorkspaceId,
    repository: Repository,
    ref: string,
  ): Promise<readonly string[] | null>;

  committed(
    workspaceId: WorkspaceId,
    repository: Repository,
    commit: RepositoryCommit,
  ): Promise<string>;
}
