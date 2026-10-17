import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import type { NoteDto } from '@work/application/dto/inbox.dto';
import type { RunStationDto } from '@work/application/dto/task-run.dto';

export interface RunSpendDto {
  readonly cost: number | null;
  readonly currency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
}

export interface RunConversationDto {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentDto[];
  readonly station: RunStationDto | null;
  readonly createdAt: string;
  readonly briefing: string;
  readonly working: boolean;
  readonly notes: readonly NoteDto[];
  readonly spend: RunSpendDto | null;
}
