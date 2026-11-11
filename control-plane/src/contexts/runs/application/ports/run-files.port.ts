import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_FILES = Symbol('RUN_FILES');

export interface RunFileFacts {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export interface RunFileSource {
  readonly owner: string;

  uploadedBy(
    runId: RunId,
    workspaceId: WorkspaceId,
    ids: readonly string[],
  ): Promise<readonly RunFileFacts[]>;

  take(workspaceId: WorkspaceId, files: readonly RunFileFacts[]): Promise<void>;
}

export interface RunFilesPort {
  register(source: RunFileSource): void;
}
