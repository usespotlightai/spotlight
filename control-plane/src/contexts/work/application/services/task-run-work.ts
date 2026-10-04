import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import { ApprovalAsked } from '@work/application/rendering/approval-asked';
import { PermissionAsked } from '@work/application/rendering/permission-asked';
import type {
  Cleared,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskMovedOnError } from '@work/domain/exceptions/task-moved-on.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { repositoryWorkedOnNamed } from '@work/domain/services/task-checkouts';
import type { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class TaskRunWork implements RunWork {
  constructor(
    private readonly run: Run,
    private readonly task: Task,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly clock: ClockPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.task.workspaceId;
  }

  async deliverUpTo(position: number, at: Date): Promise<void> {
    await this.tasks.save(
      this.task.deliveredUpTo(NotePosition.of(position), at),
    );
  }

  gave(attachmentId: string): Attachment | null {
    return (
      this.task.allAttachments.find((each) => each.id.value === attachmentId) ??
      null
    );
  }

  async repositoryNamed(name: string): Promise<Repository | null> {
    if (!this.run.stationId) {
      return null;
    }

    const line = await this.lines.holding(this.run.stationId);

    return line ? repositoryWorkedOnNamed(name, this.task, line) : null;
  }

  async clearFor(
    declared: DeclaredTool,
    call: ToolCall,
    intent: ApprovalIntent | null,
  ): Promise<Cleared> {
    const needed = declared.approval;

    if (!needed) {
      return { kind: 'given', edited: null, returned: async () => {} };
    }

    const line = await this.lines.holding(this.task.stationId);
    const { task, clearance } = this.task.clearFor(
      ApprovalSubject.toolCall(call),
      needed,
      {
        station:
          line?.stationAt(this.task.stationId)?.name ?? StationName.unknown(),
        body: TaskNoteBody.of(ApprovalAsked.body(declared, call, needed)),
        at: this.clock.now(),
        voice: Voice.station(this.run.id),
      },
      this.run.id,
      intent,
    );

    if (clearance.kind === 'refused') {
      return clearance;
    }

    await this.tasks.save(task);

    return clearance.kind === 'asked'
      ? clearance
      : {
          kind: 'given',
          edited: clearance.edited,
          returned: () => this.returned(task, clearance.claimed),
        };
  }

  async clearPermission(
    permission: HarnessPermission,
    session: HarnessSession | null,
  ): Promise<PermissionCleared> {
    const line = await this.lines.holding(this.task.stationId);
    const station = line?.stationAt(this.task.stationId) ?? null;
    const subject = ApprovalSubject.harnessPermission(permission);
    const needed = ApprovalNeeded.of(
      subject.name,
      PermissionAsked.because(station?.profile?.value ?? null),
    );
    const worked =
      session && this.run.claimedBy
        ? this.task.workedIn(session, this.run.claimedBy)
        : this.task;
    const { task, clearance } = worked.clearFor(
      subject,
      needed,
      {
        station: station?.name ?? StationName.unknown(),
        body: TaskNoteBody.of(PermissionAsked.body(permission, needed)),
        at: this.clock.now(),
        voice: Voice.station(this.run.id),
      },
      this.run.id,
      null,
    );

    if (clearance.kind !== 'refused') {
      await this.tasks.save(task);
    }

    return clearance.kind;
  }

  private async returned(claimed: Task, at: NotePosition): Promise<void> {
    try {
      await this.tasks.save(claimed.approvalReturned(at));
    } catch (error) {
      if (!(error instanceof TaskMovedOnError)) {
        throw error;
      }
    }
  }

  async toolContext(): Promise<TaskToolContext> {
    const stationId = this.run.stationId ?? this.task.stationId;
    const line = await this.lines.holding(stationId);

    if (!line) {
      throw new UnknownStationError(stationId.value);
    }

    return {
      kind: 'task',
      runId: this.run.id,
      workspaceId: this.task.workspaceId,
      taskId: this.task.id,
      stationId,
    };
  }
}
