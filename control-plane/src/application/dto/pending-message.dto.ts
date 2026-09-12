import type { AttachmentShape } from '@application/contracts/run-spec.contract';

export interface PendingMessageDto {
  readonly position: number;
  readonly body: string;
  readonly attachments: readonly AttachmentShape[];
}
