import type { AttachmentDto } from '@application/dto/attachment.dto';
import type { InboxMessageDto } from '@application/dto/inbox.dto';
import type { RunStationDto } from '@application/dto/task-run.dto';

export interface RunConversationDto {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentDto[];
  readonly station: RunStationDto | null;
  readonly createdAt: string;
  readonly briefing: string | null;
  readonly working: boolean;
  readonly notes: readonly InboxMessageDto[];
}
