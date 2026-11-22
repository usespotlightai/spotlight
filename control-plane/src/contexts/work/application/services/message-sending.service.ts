import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import type { DraftSending } from '@work/application/services/draft-sending.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { HoldStart, Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export interface MessageTarget {
  readonly taskId: TaskId;
  readonly runId: RunId | null;
  readonly stationId: StationId | null;
  readonly named: string;
}

export interface OutgoingMessage {
  readonly sentBy: string;
  readonly body: string;
  readonly coAuthors: readonly string[];
  readonly draftGeneration: number | null;
  readonly attachments: readonly Attachment[];
}

export class MessageSending {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
    private readonly files: FilesLoader,
    private readonly access: WorkAccess,
    private readonly drafts: DraftSending,
    private readonly facts: RunFactsPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async send(
    message: OutgoingMessage,
    target: MessageTarget,
  ): Promise<DraftGeneration | null> {
    const sentBy = UserId.of(message.sentBy);
    const task = await this.tasks.find(target.taskId);
    const line = task ? await this.lines.findByStation(task.stationId) : null;

    if (!task || !line) {
      throw new UnknownTaskError(target.named);
    }

    const sender = {
      person: sentBy,
      team: await this.access.standingOn(line.teamId, sentBy),
    };

    if (!sender.team.seesTasks) {
      throw new UnknownTaskError(target.named);
    }

    const coAuthors = await this.drafts.coAuthors(
      task.id,
      line.teamId,
      message.coAuthors,
    );
    const sent = DraftGeneration.sentAs(message.draftGeneration);
    const { stationId } = target;

    const at = this.clock.now();
    const newNote = {
      line,
      body: TaskNoteBody.fromInput(message.body, message.attachments),
      at,
      voice: Voice.person(sentBy, coAuthors),
      attachments: message.attachments,
    };
    const drafted = task.sendDraft(sent);
    const received = drafted.holdsOnMessage(
      target.runId,
      newNote.voice,
      stationId,
      line,
    )
      ? drafted.heldOnMessage(
          target.runId,
          await this.holdStart(drafted, line, at),
          newNote,
          stationId,
          sender,
        )
      : drafted.receiveMessage(target.runId, newNote, stationId, sender);

    await this.tasks.save(await handedToRun(this.dispatch, received, line));
    await this.files.takenIn(task.workspaceId, message.attachments);

    return sent && received.draftGeneration;
  }

  private async holdStart(
    task: Task,
    line: LineMap,
    at: Date,
  ): Promise<Omit<HoldStart, 'by'>> {
    const current = task.currentRunId;
    const [facts] = current ? await this.facts.of([current]) : [];

    return {
      id: HoldId.of(this.ids.generate()),
      members: (await this.access.membersOf(line.teamId)) ?? TeamMembers.of([]),
      line,
      currentRunStarted: facts?.started ?? false,
      at,
    };
  }
}
