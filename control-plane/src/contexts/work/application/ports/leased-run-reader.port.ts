import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

export interface PendingMessage {
  readonly position: number;
  readonly body: string;
  readonly attachments: readonly Attachment[];
}

export const LEASED_RUN_READER = Symbol('LEASED_RUN_READER');

export interface LeasedRunReaderPort {
  pendingFor(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<readonly PendingMessage[] | null>;

  stopRequestedFor(runId: RunId, runnerId: RunnerId): Promise<boolean>;
}
