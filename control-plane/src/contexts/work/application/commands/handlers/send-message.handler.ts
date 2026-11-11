import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { SendMessageCommand } from '@work/application/commands/send-message.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import type { DraftSending } from '@work/application/services/draft-sending.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

interface MessageTarget {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
}

export class SendMessageHandler implements CommandHandlerPort<
  SendMessageCommand,
  void
> {
  constructor(
    private readonly dispatches: DispatchRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly transaction: TransactionPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
    private readonly files: FilesLoader,
    private readonly access: WorkAccess,
    private readonly drafts: DraftSending,
  ) {}

  async execute(command: SendMessageCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const dispatch = await this.dispatches.find(runId);
      const subject = dispatch?.subject;

      if (!dispatch || subject?.kind !== 'task') {
        throw new UnknownTaskError(command.runId);
      }

      const { taskId, stationId } = subject;
      const attachments = await this.files.handedOver(
        dispatch.workspaceId,
        command.attachments,
      );

      const next = await this.transaction.inTransaction(() =>
        this.send(command, { runId, taskId, stationId }, attachments),
      );
      await this.drafts.announce(taskId, next, command.body);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async send(
    command: SendMessageCommand,
    target: MessageTarget,
    attachments: readonly Attachment[],
  ): Promise<DraftGeneration | null> {
    const sentBy = UserId.of(command.sentBy);
    const task = await this.tasks.find(target.taskId);
    const line = task ? await this.lines.findByStation(task.stationId) : null;

    if (!task || !line) {
      throw new UnknownTaskError(command.runId);
    }

    (await this.access.standingOn(line.teamId, sentBy)).assertActsOnTasks(
      () => new UnknownTaskError(command.runId),
    );

    const coAuthors = await this.drafts.coAuthors(
      task.id,
      line.teamId,
      command.coAuthors,
    );
    const sent = DraftGeneration.sentAs(command.draftGeneration);

    const received = task.sendDraft(sent).receiveMessage(
      target.runId,
      {
        line,
        body: TaskNoteBody.fromInput(command.body, attachments),
        at: this.clock.now(),
        voice: Voice.person(sentBy, coAuthors),
        attachments,
      },
      target.stationId,
    );

    await this.tasks.save(await handedToRun(this.dispatch, received, line));
    await this.files.takenIn(task.workspaceId, attachments);

    return sent && received.draftGeneration;
  }
}
