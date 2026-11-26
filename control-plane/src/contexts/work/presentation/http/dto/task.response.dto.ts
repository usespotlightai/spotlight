import { ApiProperty } from '@nestjs/swagger';
import { MESSAGE_OUTCOME_NAMES } from '@work/application/dto/task-run.dto';
import { PROGRESS_NAMES } from '@work/application/dto/task.dto';
import { AttachmentResponseDto } from '@work/presentation/http/dto/attachment.response.dto';
import { pageResponseOf } from '@work/presentation/http/paging';

export class TaskNoteResponseDto {
  @ApiProperty({ example: 0 })
  readonly position: number;

  @ApiProperty({ example: 'Implementation' })
  readonly station: string;

  @ApiProperty({ example: 'No runner finished the run after 3 attempts.' })
  readonly body: string;

  constructor(position: number, station: string, body: string) {
    this.position = position;
    this.station = station;
    this.body = body;
  }
}

export class TaskPersonResponseDto {
  @ApiProperty({ example: 'f2b1c9d4-3e57-4a80-9c62-1d8e5f0a7b34' })
  readonly id: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  readonly name: string;

  @ApiProperty({
    example: 'https://example.com/ada.png',
    nullable: true,
    type: String,
  })
  readonly image: string | null;

  constructor(id: string, name: string, image: string | null) {
    this.id = id;
    this.name = name;
    this.image = image;
  }
}

export class TaskHoldResponseDto {
  @ApiProperty({ type: TaskPersonResponseDto })
  readonly by: TaskPersonResponseDto;

  @ApiProperty({ example: '2026-11-16T09:15:00.000Z' })
  readonly startedAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The run of the last turn, where the person talks to the agent',
  })
  readonly runId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The station an event asked to move the task to while it was on hold. The task moves there when the line resumes at its station.',
  })
  readonly heldMoveTo: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The agent chat that holds the task while it works on the pull request itself',
  })
  readonly chatId: string | null;

  @ApiProperty({
    description:
      'Whether the caller can send the agent turns while the task is on hold',
  })
  readonly viewerDrives: boolean;

  @ApiProperty({
    description:
      'Whether the caller can resume the line or move the task while it is on hold',
  })
  readonly viewerEnds: boolean;

  constructor(
    by: TaskPersonResponseDto,
    startedAt: string,
    runId: string | null,
    heldMoveTo: string | null,
    chatId: string | null,
    viewerDrives: boolean,
    viewerEnds: boolean,
  ) {
    this.by = by;
    this.startedAt = startedAt;
    this.runId = runId;
    this.heldMoveTo = heldMoveTo;
    this.chatId = chatId;
    this.viewerDrives = viewerDrives;
    this.viewerEnds = viewerEnds;
  }
}

export class TaskRunNotStartedResponseDto {
  @ApiProperty({
    example: 'claude-code',
    description:
      'The agent the station names, which Spotlight could not start. A different agent on the station, or a Spotlight version that knows this one, lets the run start',
  })
  readonly harness: string;

  constructor(harness: string) {
    this.harness = harness;
  }
}

export class TaskReviewResponseDto {
  @ApiProperty({
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13:5',
    description: 'The inbox conversation waiting on a person',
  })
  readonly conversationId: string;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
  }
}

export class TaskResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    example: 3,
    description:
      'How many times it has moved; a move names the revision it was based on',
  })
  readonly revision: number;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({
    example: '## Steps\n\nReproduce, then fix.',
    nullable: true,
    type: String,
    description: 'Markdown',
  })
  readonly description: string | null;

  @ApiProperty({
    type: AttachmentResponseDto,
    isArray: true,
    description: 'The files it was created with',
  })
  readonly attachments: readonly AttachmentResponseDto[];

  @ApiProperty({ example: '2026-08-27T09:15:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({
    enum: [...PROGRESS_NAMES, null],
    nullable: true,
    type: String,
    example: 'in-progress',
    description:
      'What its current run is doing: queued until a runner takes it, then in progress, and stopping once someone asked it to stop. Null without a run at work.',
  })
  readonly progress: string | null;

  @ApiProperty({
    type: TaskReviewResponseDto,
    nullable: true,
    description: 'Where an open question is answered, or null for none',
  })
  readonly awaitingReview: TaskReviewResponseDto | null;

  @ApiProperty({
    description:
      'Whether the open question waits for you: you act on the tasks of the team, and you are the assignee, it asks you by name, or the task has no assignee and you are a member of the team. False for a question someone else owes.',
  })
  readonly waitingForYou: boolean;

  @ApiProperty({
    enum: MESSAGE_OUTCOME_NAMES,
    example: 'message',
    description:
      'What a message from you to the task does. A message to the task puts nothing on hold, so it is never holds, not-on-team or moved-on. answer: it answers the open question. drives: it drives the next turn while a person holds the task. reopens: it sends the finished task back to its station, where a run starts again if an agent works there. waits-for-chat: it goes to the agent chat that holds the task, and the chat takes it up at once. The station agent reads it once the task is handed back to the line. message: it adds a message, and starts a run that did not start. awaits-another: it is refused, because the question waits for another person. not-acting: it is refused, because you do not act on the tasks of the team.',
  })
  readonly yourMessage: string;

  @ApiProperty({
    description:
      'Whether the line finished the task. A message to a finished task sends it back to its station, unless it finished at the completed station.',
  })
  readonly finished: boolean;

  @ApiProperty({
    type: [String],
    example: ['station_backlog', 'station_triage', 'station_spec'],
    description:
      'The stations a person may move the task to by hand, its own station among them. While the task waits on a question, they include the stations its station passes work to, as its agent could.',
  })
  readonly movableTo: readonly string[];

  @ApiProperty({
    example: ['https://github.com/acme/widgets/pull/7'],
    type: [String],
    description:
      'The pull requests this task ended in, one for each repository, the first opened first',
  })
  readonly pullRequests: readonly string[];

  @ApiProperty({
    type: TaskPersonResponseDto,
    nullable: true,
    description:
      'The person who created it. The task comes back to this person',
  })
  readonly createdBy: TaskPersonResponseDto | null;

  @ApiProperty({
    type: TaskPersonResponseDto,
    nullable: true,
    description: 'The team member who owns the work, or nobody where unclaimed',
  })
  readonly assignee: TaskPersonResponseDto | null;

  @ApiProperty({
    type: TaskNoteResponseDto,
    nullable: true,
    description:
      'The last note on this task, and the station where it was written',
  })
  readonly note: TaskNoteResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'linear',
    description:
      'The integration that opened it, or null where a person created it',
  })
  readonly source: string | null;

  @ApiProperty({
    type: TaskHoldResponseDto,
    nullable: true,
    description:
      'The person who drives the task at its station in place of the line, or null where the line drives it',
  })
  readonly hold: TaskHoldResponseDto | null;

  @ApiProperty({
    type: TaskRunNotStartedResponseDto,
    nullable: true,
    description:
      'Why no run works the task at its station: Spotlight tried to start the station’s agent and could not. Null while a run works it, or when nothing tried',
  })
  readonly runNotStarted: TaskRunNotStartedResponseDto | null;

  constructor(
    id: string,
    stationId: string,
    revision: number,
    title: string,
    description: string | null,
    attachments: readonly AttachmentResponseDto[],
    createdAt: string,
    progress: string | null,
    awaitingReview: TaskReviewResponseDto | null,
    waitingForYou: boolean,
    yourMessage: string,
    finished: boolean,
    movableTo: readonly string[],
    pullRequests: readonly string[],
    createdBy: TaskPersonResponseDto | null,
    assignee: TaskPersonResponseDto | null,
    note: TaskNoteResponseDto | null,
    source: string | null,
    hold: TaskHoldResponseDto | null,
    runNotStarted: TaskRunNotStartedResponseDto | null,
  ) {
    this.id = id;
    this.stationId = stationId;
    this.revision = revision;
    this.title = title;
    this.description = description;
    this.attachments = attachments;
    this.createdAt = createdAt;
    this.progress = progress;
    this.awaitingReview = awaitingReview;
    this.waitingForYou = waitingForYou;
    this.yourMessage = yourMessage;
    this.finished = finished;
    this.movableTo = movableTo;
    this.pullRequests = pullRequests;
    this.createdBy = createdBy;
    this.assignee = assignee;
    this.note = note;
    this.source = source;
    this.hold = hold;
    this.runNotStarted = runNotStarted;
  }
}

export const TaskPageResponseDto = pageResponseOf(TaskResponseDto);
