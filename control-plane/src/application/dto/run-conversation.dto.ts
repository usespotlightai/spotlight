import type { InboxMessageDto } from '@application/dto/inbox.dto';
import type { RunStationDto } from '@application/dto/task-run.dto';

export interface RunConversationDto {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly station: RunStationDto | null;
  readonly createdAt: string;
  readonly briefing: string | null;
  readonly working: boolean;
  readonly notes: readonly InboxMessageDto[];
}
