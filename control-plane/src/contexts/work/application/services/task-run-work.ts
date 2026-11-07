import type { LeasedRunFacts } from '@runs/application/ports/run-leases.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ConnectionMissingDto,
  MissingConnectionReason,
} from '@work/application/ports/integration-tool-calls.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { ApprovalAsked } from '@work/application/rendering/approval-asked';
import { ConnectionAsked as ConnectionAskedText } from '@work/application/rendering/connection-asked';
import { PermissionAsked } from '@work/application/rendering/permission-asked';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { repositoryForTaskNamed } from '@work/domain/services/task-checkouts';
import type { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import {
  ConnectionAsk,
  type MissingConnection,
} from '@work/domain/value-objects/connection-ask.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const RETURN_ATTEMPTS = 3;

const MISSING_CONNECTIONS: Readonly<
  Record<MissingConnectionReason, MissingConnection>
> = {
  'not-connected': 'not-connected',
  'refresh-failed': 'refresh-failed',
  'no-requester': 'no-requester',
  'not-a-member': 'not-a-member',
};

export class TaskRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRunFacts,
    private readonly task: Task,
    private readonly stationId: StationId,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly clock: ClockPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.task.workspaceId;
  }

  async acknowledgeUpTo(position: number, at: Date): Promise<void> {
    await this.tasks.save(
      this.task.acknowledgeUpTo(this.run.runId, NotePosition.of(position), at),
    );
  }

  attachment(attachmentId: string): Attachment | null {
    return (
      this.task.allAttachments.find((each) => each.id.value === attachmentId) ??
      null
    );
  }

  async repositoryNamed(name: string): Promise<Repository | null> {
    const line = await this.lines.findByStation(this.stationId);

    const named = RepositoryName.parsed(name);

    return line && named
      ? repositoryForTaskNamed(named, this.task, line)
      : null;
  }

  async clearFor(
    declared: DeclaredTool,
    call: ToolCall,
    intent: ApprovalIntent | null,
  ): Promise<Cleared> {
    const needed = declared.approval;

    if (!needed) {
      return { kind: 'approved', edited: null, returned: async () => {} };
    }

    const line = await this.lines.findByStation(this.task.stationId);
    const { task, check } = this.task.clearFor(
      ApprovalSubject.toolCall(call),
      needed,
      {
        line,
        body: TaskNoteBody.of(ApprovalAsked.body(declared, call, needed)),
        at: this.clock.now(),
        voice: Voice.station(this.run.runId),
      },
      this.run.runId,
      intent,
    );

    if (check.kind === 'dismissed') {
      return check;
    }

    await this.tasks.save(task);

    return check.kind === 'pending'
      ? check
      : {
          kind: 'approved',
          edited: check.edited,
          returned: () => this.returned(task, check.claimed),
        };
  }

  async askToConnect(
    declared: DeclaredTool,
    missing: ConnectionMissingDto,
  ): Promise<ConnectionAsked> {
    if (
      !missing.personId ||
      !ConnectionAsk.askableWhen(MISSING_CONNECTIONS[missing.because])
    ) {
      return { kind: 'denied', reason: ConnectionAskedText.denial(missing) };
    }

    const line = await this.lines.findByStation(this.task.stationId);

    if (!line) {
      throw new UnknownStationError(this.task.stationId.value);
    }

    const { task, asked } = this.task.askToConnect(
      this.run.runId,
      {
        line,
        body: TaskNoteBody.of(ConnectionAskedText.body(declared, missing)),
        at: this.clock.now(),
        voice: Voice.station(this.run.runId),
      },
      ConnectionAsk.of({
        teamId: line.teamId,
        integration: IntegrationName.of(missing.integration),
        providedBy: missing.integrationName,
        personId: UserId.of(missing.personId),
      }),
    );

    if (!asked) {
      return {
        kind: 'denied',
        reason: ConnectionAskedText.busy(missing),
      };
    }

    if (task !== this.task) {
      await this.tasks.save(task);
    }

    return { kind: 'asked' };
  }

  async clearPermission(
    permission: HarnessPermission,
    session: HarnessSession | null,
  ): Promise<PermissionCleared> {
    const line = await this.lines.findByStation(this.task.stationId);
    const station = line?.stationAt(this.task.stationId) ?? null;
    const subject = ApprovalSubject.harnessPermission(permission);
    const needed = ApprovalNeeded.of(
      subject.name,
      PermissionAsked.because(station?.profile?.value ?? null),
    );
    const recorded = session
      ? this.task.recordSession(this.run.runId, session, this.run.claimedBy)
      : this.task;
    const { task, check } = recorded.clearFor(
      subject,
      needed,
      {
        line,
        body: TaskNoteBody.of(PermissionAsked.body(permission, needed)),
        at: this.clock.now(),
        voice: Voice.station(this.run.runId),
      },
      this.run.runId,
      null,
    );

    if (check.kind !== 'dismissed') {
      await this.tasks.save(task);
    }

    return check.kind;
  }

  private async returned(claimed: Task, at: NotePosition): Promise<void> {
    let current: Task | null = claimed;

    for (let attempt = 1; current; attempt++) {
      try {
        await this.tasks.save(current.returnApproval(at));
        return;
      } catch (error) {
        if (
          !(error instanceof TaskVersionConflictError) ||
          attempt >= RETURN_ATTEMPTS
        ) {
          throw error;
        }
      }

      current = await this.tasks.find(claimed.id);
    }
  }

  async toolContext(): Promise<TaskToolContext> {
    const line = await this.lines.findByStation(this.stationId);

    if (!line) {
      throw new UnknownStationError(this.stationId.value);
    }

    return {
      kind: 'task',
      runId: this.run.runId,
      workspaceId: this.task.workspaceId,
      taskId: this.task.id,
      stationId: this.stationId,
      requester: this.task.createdBy,
    };
  }
}
