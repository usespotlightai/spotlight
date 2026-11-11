import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type { InboxNote } from '@work/application/ports/inbox-reader.port';
import type { RunsInWorkspace } from '@work/application/ports/viewed-runs';
import type { ReviewState } from '@work/domain/services/conversations';
import type { Progress } from '@work/domain/value-objects/progress';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import type { TaskRunState } from '@work/domain/value-objects/task-run-state';

export interface RunReview {
  readonly state: ReviewState;
  readonly conversationId: string;
}

export interface RunStationSummary {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

export interface TaskRunSummary {
  readonly id: string;
  readonly state: TaskRunState;
  readonly progress: Progress | null;
  readonly attempt: number;
  readonly exitCode: number | null;
  readonly startedAt: Date;
  readonly updatedAt: Date;
  readonly endedAt: Date | null;
  readonly harness: string;
  readonly image: string | null;
  readonly station: RunStationSummary | null;
  readonly review: RunReview | null;
}

export interface TeamRunSummary extends TaskRunSummary {
  readonly taskId: string | null;
  readonly taskTitle: string | null;
  readonly taskDescription: string | null;
}

export interface RunNotesSummary {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentSummary[];
  readonly station: RunStationSummary | null;
  readonly createdAt: Date;
  readonly briefing: string;
  readonly progress: Progress | null;
  readonly latestRun: LatestRunSummary;
  readonly notes: readonly InboxNote[];
}

interface LatestRunSummary {
  readonly id: string;
  readonly state: TaskRunState;
  readonly progress: Progress | null;
}

export interface RanConfig {
  readonly runId: string;
  readonly fingerprint: string;
  readonly parts: StationConfigParts;
}

export interface RunConfigView extends RanConfig {
  readonly taskId: string;
}

export interface RunConfigSummary {
  readonly ran: RanConfig | null;
  readonly before: RunConfigView | null;
}

export const RUN_READER = Symbol('RUN_READER');

export interface RunReaderPort {
  listForTask(
    taskId: TaskId,
  ): Promise<RunsInWorkspace<TaskRunSummary[]> | null>;

  listForTeam(teamId: TeamId, page: PageRequest): Promise<Page<TeamRunSummary>>;

  findForTeam(teamId: TeamId, runId: RunId): Promise<TeamRunSummary | null>;

  notesFor(runId: RunId): Promise<RunsInWorkspace<RunNotesSummary> | null>;

  configFor(runId: RunId): Promise<RunsInWorkspace<RunConfigSummary> | null>;
}
