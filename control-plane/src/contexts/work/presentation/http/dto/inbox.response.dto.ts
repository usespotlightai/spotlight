import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  APPROVAL_STANDING,
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

export class InboxApprovalResponseDto {
  @ApiProperty({ example: 'linear.comment' })
  readonly tool: string;

  @ApiProperty({
    example: 'It posts publicly, under the team’s name.',
    description: 'Why the tool cannot run until a person says so',
  })
  readonly because: string;

  @ApiProperty({
    type: InboxApprovalInputResponseDto,
    isArray: true,
    description: 'What the tool would be called with, exactly as it stands',
  })
  readonly inputs: readonly InboxApprovalInputResponseDto[];

  @ApiProperty({ example: 'asked', enum: [...APPROVAL_STANDING] })
  readonly standing: string;

  constructor(
    tool: string,
    because: string,
    inputs: readonly InboxApprovalInputResponseDto[],
    standing: string,
  ) {
    this.tool = tool;
    this.because = because;
    this.inputs = inputs;
    this.standing = standing;
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
    this.notes = notes;
  }
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
}
