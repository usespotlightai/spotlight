import type {
  RunFileFacts,
  RunFileSource,
} from '@runs/application/ports/run-files.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class RunFiles implements RunFileSource {
  readonly owner = WorkRequesters.owner;

  constructor(private readonly files: FilesLoader) {}

  async uploadedBy(
    runId: RunId,
    workspaceId: WorkspaceId,
    ids: readonly string[],
  ): Promise<readonly RunFileFacts[]> {
    const found = await this.files.uploadedBy(runId, workspaceId, ids);

    return found.map((each) => ({
      id: each.id.value,
      name: each.name,
      contentType: each.contentType,
      size: each.size,
    }));
  }

  async take(
    workspaceId: WorkspaceId,
    files: readonly RunFileFacts[],
  ): Promise<void> {
    await this.files.takenIn(
      workspaceId,
      files.map((each) => Attachment.rehydrate(each)),
    );
  }
}
