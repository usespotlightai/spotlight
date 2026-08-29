import type { TaskNoteDto } from '@application/dto/task.dto';

export interface InboxItemDto {
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly description: string | null;
  readonly station: string;
  readonly stationColor: string;
  readonly askedAt: string;
  readonly notes: readonly TaskNoteDto[];
}
