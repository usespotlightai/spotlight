import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

export interface RunWork {
  readonly workspaceId: WorkspaceId;
  deliverUpTo(position: number, at: Date): Promise<void>;
  gave(attachmentId: string): Attachment | null;
  repositoryNamed(name: string): Promise<Repository | null>;
  toolContext(): Promise<ToolContext>;
}
