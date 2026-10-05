import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  APPROVAL_STANDING,
  APPROVAL_SUBJECTS,
  INBOX_ASIDE_FORMS,
  INBOX_NOTICE_FORMS,
  type InboxApprovalDto,
  type InboxAsideDto,
  type InboxConnectionDto,
  type InboxFailureDto,
  type InboxNoticeDto,
  NOTE_FORMS,
  NOTE_KINDS,
  NOTE_VOICES,
} from '@work/application/dto/inbox.dto';
import { AttachmentResponseDto } from '@work/presentation/http/dto/attachment.response.dto';

export class InboxAuthorResponseDto {
  @ApiProperty({ example: 'b7f3c1d9-2a48-4e6b-9c05-7d1e3f8a2b64' })
  readonly id: string;

  @ApiProperty({ example: 'Leon' })
  readonly name: string;

  @ApiProperty({ nullable: true, type: String })
  readonly image: string | null;

  constructor(id: string, name: string, image: string | null) {
    this.id = id;
    this.name = name;
    this.image = image;
  }
}

export class InboxApprovalInputResponseDto {
  @ApiProperty({ example: 'issue' })
  readonly name: string;

  @ApiProperty({ example: 'ENG-12' })
  readonly value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}

export class InboxApprovalAskedOfResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly id: string;

  @ApiProperty({ example: 'Alice Martin' })
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

export class InboxApprovalResponseDto {
  @ApiProperty({
    example: 'tool-call',
    enum: [...APPROVAL_SUBJECTS],
    description:
      'Whether a tool call or a harness asking permission waits on a person',
  })
  readonly kind: string;

  @ApiProperty({
    example: 'linear.comment',
    description:
      'The tool, or the harness and the kind of action it asked about, as in claude-code execute',
  })
  readonly name: string;

  @ApiProperty({
    example: 'It posts publicly, under the team’s name.',
    description: 'Why it cannot go ahead until a person says so',
  })
  readonly because: string;

  @ApiProperty({
    type: InboxApprovalInputResponseDto,
    isArray: true,
    description: 'What it would go ahead with, exactly as it stands',
  })
  readonly inputs: readonly InboxApprovalInputResponseDto[];

  @ApiProperty({ example: 'asked', enum: [...APPROVAL_STANDING] })
  readonly standing: string;

  @ApiProperty({
    type: InboxApprovalInputResponseDto,
    isArray: true,
    nullable: true,
    description:
      'What it was approved to run with instead, where the person changed it',
  })
  readonly edited: readonly InboxApprovalInputResponseDto[] | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example:
      'post the drain summary on ENG-412, publicly under the team’s name',
    description:
      'What the agent said it wants to do, completing “Spotlight would like to …”; absent where it said nothing, as a harness asking permission never does',
  })
  readonly intent: string | null;

  @ApiProperty({
    type: InboxApprovalAskedOfResponseDto,
    nullable: true,
    description:
      'The one person who can approve it, where it asks first because of their own rule for their connection; anyone can still dismiss it',
  })
  readonly askedOf: InboxApprovalAskedOfResponseDto | null;

  constructor(approval: InboxApprovalDto) {
    this.kind = approval.kind;
    this.name = approval.name;
    this.because = approval.because;
    this.inputs = approval.inputs.map(
      (input) => new InboxApprovalInputResponseDto(input.name, input.value),
    );
    this.standing = approval.standing;
    this.edited =
      approval.edited?.map(
        (input) => new InboxApprovalInputResponseDto(input.name, input.value),
      ) ?? null;
    this.intent = approval.intent;
    this.askedOf = approval.askedOf
      ? new InboxApprovalAskedOfResponseDto(
          approval.askedOf.id,
          approval.askedOf.name,
        )
      : null;
  }
}

export class InboxAsideResponseDto {
  @ApiProperty({
    enum: INBOX_ASIDE_FORMS,
    example: 'memories',
    description:
      'What is put aside for a person to settle, beside the task’s conversation: memories are proposed memories to approve or reject; grade asks a person to grade a judged run',
  })
  readonly form: string;

  @ApiProperty({
    example: 'run_1',
    description:
      'What it is about: for memories, the run that proposed them; for grade, the run to grade',
  })
  readonly about: string;

  constructor(aside: InboxAsideDto) {
    this.form = aside.form;
    this.about = aside.about;
  }
}

export class InboxFailureResponseDto {
  @ApiProperty({
    example: 'run',
    description:
      'Where the failure came from: the run, or the hook that failed',
  })
  readonly source: string;

  @ApiProperty({
    example: 'exited',
    description: 'What kind of failure it was',
  })
  readonly code: string;

  @ApiProperty({
    example: 3,
    description:
      'How many times it happened while this was open, rather than asking again each time',
  })
  readonly occurrences: number;

  constructor(failure: InboxFailureDto) {
    this.source = failure.source;
    this.code = failure.code;
    this.occurrences = failure.occurrences;
  }
}

export class InboxConnectionResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly integration: string;

  @ApiProperty({
    example: 'user_1',
    description:
      'The person asked to connect, whose connection the tool acts with',
  })
  readonly personId: string;

  @ApiProperty({ example: 'Alice Martin' })
  readonly personName: string;

  @ApiProperty({ description: 'Whether they have connected since' })
  readonly met: boolean;

  constructor(connection: InboxConnectionDto) {
    this.source = connection.source;
    this.integration = connection.integration;
    this.personId = connection.personId;
    this.personName = connection.personName;
    this.met = connection.met;
  }
}

export class InboxMessageResponseDto {
  @ApiProperty({ example: 0 })
  readonly position: number;

  @ApiProperty({
    example: 'asked',
    enum: [...NOTE_KINDS],
  })
  readonly kind: string;

  @ApiProperty({
    example: 'words',
    enum: [...NOTE_FORMS],
    description: 'What it shows, which is not what it did',
  })
  readonly form: string;

  @ApiProperty({
    example: 'station',
    enum: [...NOTE_VOICES],
    description: 'Who spoke: the station, a person, or the world outside it',
  })
  readonly voice: string;

  @ApiProperty({ example: 'Implementation' })
  readonly station: string;

  @ApiProperty({ example: '#edc12b' })
  readonly stationColor: string;

  @ApiProperty({ example: 2, description: 'Its place in the line, from zero' })
  readonly stationPosition: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The run that wrote it, whose journal it came from',
  })
  readonly runId: string | null;

  @ApiProperty({ example: 'Reproduced on restart. Needs a spec.' })
  readonly body: string;

  @ApiProperty({
    type: AttachmentResponseDto,
    isArray: true,
    description: 'The files handed over with it',
  })
  readonly attachments: readonly AttachmentResponseDto[];

  @ApiProperty({ example: '2026-08-28T21:15:00.000Z' })
  readonly at: string;

  @ApiProperty({
    type: InboxAuthorResponseDto,
    nullable: true,
    description: 'Absent where the station said it rather than a person',
  })
  readonly author: InboxAuthorResponseDto | null;

  @ApiProperty({
    type: InboxApprovalResponseDto,
    nullable: true,
    description: 'The tool call this asks a person to approve, where it is one',
  })
  readonly approval: InboxApprovalResponseDto | null;

  @ApiProperty({
    type: InboxFailureResponseDto,
    nullable: true,
    description: 'The failure it reports, where it reports one',
  })
  readonly failure: InboxFailureResponseDto | null;

  @ApiProperty({
    type: InboxConnectionResponseDto,
    nullable: true,
    description:
      'The connection this asks a person to make, where a tool acts as them and they have not connected',
  })
  readonly connection: InboxConnectionResponseDto | null;

  constructor(
    position: number,
    kind: string,
    form: string,
    voice: string,
    station: string,
    stationColor: string,
    stationPosition: number,
    runId: string | null,
    body: string,
    attachments: readonly AttachmentResponseDto[],
    at: string,
    author: InboxAuthorResponseDto | null,
    approval: InboxApprovalResponseDto | null,
    failure: InboxFailureResponseDto | null,
    connection: InboxConnectionResponseDto | null,
  ) {
    this.position = position;
    this.kind = kind;
    this.form = form;
    this.voice = voice;
    this.station = station;
    this.stationColor = stationColor;
    this.stationPosition = stationPosition;
    this.runId = runId;
    this.body = body;
    this.attachments = attachments;
    this.at = at;
    this.author = author;
    this.approval = approval;
    this.failure = failure;
    this.connection = connection;
  }
}

export class InboxStationResponseDto {
  @ApiProperty({ example: 'Triage' })
  readonly name: string;

  @ApiProperty({ example: '#edc12b' })
  readonly color: string;

  @ApiProperty({ example: 0 })
  readonly position: number;

  constructor(name: string, color: string, position: number) {
    this.name = name;
    this.color = color;
    this.position = position;
  }
}

export class InboxItemResponseDto {
  @ApiProperty({
    enum: ['task'],
    description: 'A task’s conversation or what was put aside beside it',
  })
  readonly kind = 'task' as const;

  @ApiProperty({
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13:2',
    description: 'One conversation a person was asked to own',
  })
  readonly id: string;

  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly teamId: string;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({ nullable: true, type: String })
  readonly description: string | null;

  @ApiProperty({
    type: AttachmentResponseDto,
    isArray: true,
    description: 'The files the task was raised with',
  })
  readonly attachments: readonly AttachmentResponseDto[];

  @ApiProperty({ example: 'Implementation' })
  readonly station: string;

  @ApiProperty({ example: '#edc12b' })
  readonly stationColor: string;

  @ApiProperty({ example: 2, description: 'Its place in the line, from zero' })
  readonly stationPosition: number;

  @ApiProperty({ example: 4, description: 'How many stations the line holds' })
  readonly stationCount: number;

  @ApiProperty({
    type: InboxStationResponseDto,
    description: 'Where it was raised, which it keeps as it moves',
  })
  readonly raisedAt: InboxStationResponseDto;

  @ApiProperty({
    type: InboxStationResponseDto,
    description: 'Where the task stands now, which is where it ended up',
  })
  readonly standsAt: InboxStationResponseDto;

  @ApiProperty({ example: '2026-08-28T09:02:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: '2026-08-28T21:15:00.000Z' })
  readonly askedAt: string;

  @ApiProperty({
    example: false,
    description: 'True once it is settled, and is no longer yours to answer',
  })
  readonly resolved: boolean;

  @ApiProperty({
    example: false,
    description: 'True while a run is working it, so an answer is coming',
  })
  readonly working: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The run working it now, whose steps can be watched as they land',
  })
  readonly runId: string | null;

  @ApiProperty({
    example: true,
    description: 'Something was asked here that they have not seen yet',
  })
  readonly unread: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the station that opened this conversation was given',
  })
  readonly briefing: string | null;

  @ApiProperty({
    type: InboxFailureResponseDto,
    nullable: true,
    description:
      'The failure this conversation is about, where it is about one',
  })
  readonly failure: InboxFailureResponseDto | null;

  @ApiProperty({
    type: InboxAsideResponseDto,
    nullable: true,
    description:
      'What this item puts aside for a person to settle, where it is not a conversation; it never holds the task up',
  })
  readonly aside: InboxAsideResponseDto | null;

  @ApiProperty({ type: InboxMessageResponseDto, isArray: true })
  readonly notes: readonly InboxMessageResponseDto[];

  constructor(
    id: string,
    taskId: string,
    teamId: string,
    title: string,
    description: string | null,
    attachments: readonly AttachmentResponseDto[],
    station: string,
    stationColor: string,
    stationPosition: number,
    stationCount: number,
    raisedAt: InboxStationResponseDto,
    standsAt: InboxStationResponseDto,
    createdAt: string,
    askedAt: string,
    resolved: boolean,
    working: boolean,
    runId: string | null,
    unread: boolean,
    briefing: string | null,
    failure: InboxFailureResponseDto | null,
    aside: InboxAsideResponseDto | null,
    notes: readonly InboxMessageResponseDto[],
  ) {
    this.id = id;
    this.taskId = taskId;
    this.teamId = teamId;
    this.title = title;
    this.description = description;
    this.attachments = attachments;
    this.station = station;
    this.stationColor = stationColor;
    this.stationPosition = stationPosition;
    this.stationCount = stationCount;
    this.raisedAt = raisedAt;
    this.standsAt = standsAt;
    this.createdAt = createdAt;
    this.askedAt = askedAt;
    this.resolved = resolved;
    this.working = working;
    this.runId = runId;
    this.unread = unread;
    this.briefing = briefing;
    this.failure = failure;
    this.aside = aside;
    this.notes = notes;
  }
}

export class InboxNoticeResponseDto {
  @ApiProperty({
    enum: ['notice'],
    description:
      'Word put to one person about their team’s work, outside any task',
  })
  readonly kind = 'notice' as const;

  @ApiProperty({ example: 'b2d9e4f1-7c3a-4e58-9b1d-6f0a2c8e5d37' })
  readonly id: string;

  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly teamId: string;

  @ApiProperty({
    enum: INBOX_NOTICE_FORMS,
    description:
      'ended when work the person started has ended and they may want to act on how; advice when it carries on but suggests something they could fix',
  })
  readonly form: string;

  @ApiProperty({
    example: 'The search for a better Build config stalled',
  })
  readonly headline: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: [
      'Fix the judge: the rubric asks for tests the task never needed.',
    ],
    description: 'What happened, then what it suggests, one point each',
  })
  readonly points: readonly string[];

  @ApiProperty({
    example: 'lines/line_1/stations/station_1/searches/search_1',
    description: 'Where to look, as a path within its team',
  })
  readonly link: string;

  @ApiProperty({
    example: 'Open the search',
    description: 'What to call the link, naming where it leads',
  })
  readonly linkLabel: string;

  @ApiProperty({ example: '2026-08-28T21:15:00.000Z' })
  readonly askedAt: string;

  @ApiProperty({ example: true, description: 'Not seen yet' })
  readonly unread: boolean;

  @ApiProperty({
    example: false,
    description: 'True once its person settled it',
  })
  readonly resolved: boolean;

  constructor(notice: InboxNoticeDto) {
    this.id = notice.id;
    this.teamId = notice.teamId;
    this.form = notice.form;
    this.headline = notice.headline;
    this.points = [...notice.points];
    this.link = notice.link;
    this.linkLabel = notice.linkLabel;
    this.askedAt = notice.askedAt;
    this.unread = notice.unread;
    this.resolved = notice.resolved;
  }
}

export const INBOX_ENTRY_SCHEMA = {
  type: 'array' as const,
  items: {
    oneOf: [
      { $ref: getSchemaPath(InboxItemResponseDto) },
      { $ref: getSchemaPath(InboxNoticeResponseDto) },
    ],
    discriminator: {
      propertyName: 'kind',
      mapping: {
        task: getSchemaPath(InboxItemResponseDto),
        notice: getSchemaPath(InboxNoticeResponseDto),
      },
    },
  },
};

export class AnswerInboxItemInputRequestDto {
  @ApiProperty({ example: 'body' })
  readonly name!: string;

  @ApiProperty({ example: 'Fixed in #41.' })
  readonly value!: string;
}

export class AnswerInboxItemRequestDto {
  @ApiProperty({
    example: 'Drain the queue before retrying, and cap it at 500.',
    description:
      'What the person says back. It joins the task’s trail. May be empty where files are attached.',
  })
  readonly body!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Where the conversation asks for a tool call to be approved: true lets it run, false rejects it. Left out, the words answer it and the tool call stays undecided. Refused anywhere else.',
  })
  readonly approve?: boolean;

  @ApiPropertyOptional({
    type: AnswerInboxItemInputRequestDto,
    isArray: true,
    description:
      'With approve: true on a tool call, what it runs with instead, as the person changed it. Names exactly the inputs it asked with; a harness asking permission takes no changes.',
  })
  readonly inputs?: AnswerInboxItemInputRequestDto[];
}
