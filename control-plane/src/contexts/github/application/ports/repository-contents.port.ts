import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REPOSITORY_CONTENTS = Symbol('REPOSITORY_CONTENTS');

export interface RepositoryFile {
  readonly path: string;
  readonly text: string;
}

export interface Reading {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly ref: string;
  readonly path: string;
}

export interface RepositoryContentsPort {
  headOf(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<string | null>;

  read(reading: Reading): Promise<RepositoryFile | null>;

  under(reading: Reading): Promise<readonly RepositoryFile[]>;
}
