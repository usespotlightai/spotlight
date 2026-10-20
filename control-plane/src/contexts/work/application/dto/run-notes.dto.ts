import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import type { NoteDto } from '@work/application/dto/inbox.dto';
import type { RunStationDto } from '@work/application/dto/task-run.dto';
import type { Work } from '@work/domain/value-objects/run-state';

export interface RunSpendDto {
  readonly cost: number | null;
  readonly currency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
}

interface LatestRunDto {
  readonly id: string;
  readonly state: string;
  readonly stopping: boolean;
  readonly work: Work | null;
}

export interface RunNotesDto {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentDto[];
  readonly station: RunStationDto | null;
  readonly createdAt: string;
  readonly briefing: string;
  readonly work: Work | null;
  readonly latestRun: LatestRunDto;
  readonly notes: readonly NoteDto[];
  readonly spend: RunSpendDto | null;
}
