import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';

export interface PendingSaying {
  readonly position: number;
  readonly body: string;
  readonly attachments: readonly Attachment[];
}

export interface HeldAttachment {
  readonly workspaceId: WorkspaceId;
  readonly attachment: Attachment;
}

export interface HeldContinuity {
  readonly workspaceId: WorkspaceId;
  readonly continuity: ContinuityKey | null;
  readonly holder: ArchiveHolder | null;
  readonly continuing: boolean;
}

export const HELD_RUN_READER = Symbol('HELD_RUN_READER');

export interface HeldRunReaderPort {
  pendingFor(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<readonly PendingSaying[] | null>;

  stopRequestedFor(runId: RunId, runnerId: RunnerId): Promise<boolean>;

  attachmentFor(
    runId: RunId,
    runnerId: RunnerId,
    attachmentId: string,
  ): Promise<HeldAttachment | null>;

  continuityOf(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<HeldContinuity | null>;
}
