import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ComposeFile } from '@work/domain/services/compose-services';

export const COMPOSE_FILES = Symbol('COMPOSE_FILES');

/** A repository a run checks out, at the branch or commit it checks out, or at its default branch where null. */
export interface ServicesAt {
  readonly repository: Repository;
  readonly ref: string | null;
}

/** Reads the Compose files at the top of a checkout, each with the services it declares. */
export interface ComposeFilesPort {
  at(
    workspaceId: WorkspaceId,
    checkout: ServicesAt,
  ): Promise<readonly ComposeFile[]>;
}
