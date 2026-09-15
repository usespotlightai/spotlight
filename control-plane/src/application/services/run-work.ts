import type { ToolContext } from '@application/ports/integration-tools.port';
import type { Attachment } from '@domain/value-objects/attachment.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface PendingSaying {
  readonly position: number;
  readonly body: string;
  readonly attachments: readonly Attachment[];
}

export interface RunWork {
  readonly workspaceId: WorkspaceId;
  pending(): readonly PendingSaying[];
  deliverUpTo(position: number, at: Date): Promise<void>;
  gave(attachmentId: string): Attachment | null;
  repositoryNamed(name: string): Promise<Repository | null>;
  toolContext(): Promise<ToolContext>;
}
