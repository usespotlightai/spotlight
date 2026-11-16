import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
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
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
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
    private readonly facts: RunFactsPort,
    private readonly ids: IdGeneratorPort,
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
    const members =
      (await this.access.membersOf(line.teamId)) ?? TeamMembers.of([]);

    const at = this.clock.now();
    const newNote = {
      line,
      body: TaskNoteBody.fromInput(command.body, attachments),
      at,
      voice: Voice.person(sentBy, coAuthors),
      attachments,
    };
    const drafted = task.sendDraft(sent);
    const received = drafted.holdsOnMessage(
      target.runId,
      newNote.voice,
      target.stationId,
      line,
    )
      ? (await this.held(drafted, line, sentBy, members, at)).addMessage(
          newNote,
          target.stationId,
        )
      : drafted.receiveMessage(
          target.runId,
          newNote,
          target.stationId,
          members,
        );

    await this.tasks.save(await handedToRun(this.dispatch, received, line));
    await this.files.takenIn(task.workspaceId, attachments);

    return sent && received.draftGeneration;
  }

  private async held(
    task: Task,
    line: LineMap,
    by: UserId,
    members: TeamMembers,
    at: Date,
  ): Promise<Task> {
    const current = task.currentRunId;
    const [facts] = current ? await this.facts.of([current]) : [];

    return task.hold({
      id: HoldId.of(this.ids.generate()),
      by,
      members,
      line,
      verdict: null,
      currentRunStarted: facts?.started ?? false,
      at,
    });
  }
}
