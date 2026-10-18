import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type { InboxNote } from '@work/application/ports/inbox-reader.port';
import type { ReviewState } from '@work/domain/services/conversations';
import type { RunState } from '@work/domain/value-objects/run-state';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';

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
  readonly state: RunState;
  readonly attempt: number;
  readonly exitCode: number | null;
  readonly startedAt: Date;
  readonly updatedAt: Date;
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
  readonly working: boolean;
  readonly notes: readonly InboxNote[];
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
  readonly ranForTeam: RanForTeam | null;
}

interface RanForTeam {
  readonly workspaceId: string;
  readonly teamId: string | null;
}

interface RunAgentSummary {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

interface ReplayedRunSummary {
  readonly runId: string;
  readonly taskId: string | null;
  readonly title: string | null;
}

export interface ReplayRunSummary extends TaskRunSummary {
  readonly original: ReplayedRunSummary;
  readonly briefing: string;
  readonly agent: RunAgentSummary;
  readonly repositories: readonly string[];
}

export interface SearchRunSummary extends TaskRunSummary {
  readonly searchId: string;
  readonly iteration: number;
  readonly failure: string | null;
  readonly endedAt: Date | null;
  readonly briefing: string;
}

export const RUN_READER = Symbol('RUN_READER');

export interface RunReaderPort {
  listForTask(taskId: TaskId, viewerId: UserId): Promise<TaskRunSummary[]>;

  listForTeam(teamId: TeamId, viewerId: UserId): Promise<TeamRunSummary[]>;

  notesFor(runId: RunId, viewerId: UserId): Promise<RunNotesSummary | null>;

  configFor(runId: RunId, viewerId: UserId): Promise<RunConfigSummary | null>;

  replayFor(
    teamId: TeamId,
    workspaceId: WorkspaceId,
    runId: RunId,
  ): Promise<ReplayRunSummary | null>;

  searchRunFor(
    teamId: TeamId,
    workspaceId: WorkspaceId,
    runId: RunId,
  ): Promise<SearchRunSummary | null>;
}
