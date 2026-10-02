import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

export interface PendingSaying {
  readonly position: number;
  readonly body: string;
  readonly attachments: readonly Attachment[];
}

export const HELD_RUN_READER = Symbol('HELD_RUN_READER');

export interface HeldRunReaderPort {
  pendingFor(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<readonly PendingSaying[] | null>;

  stopRequestedFor(runId: RunId, runnerId: RunnerId): Promise<boolean>;
}
