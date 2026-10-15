import { ApiProperty } from '@nestjs/swagger';
import type {
  AdoptionDto,
  HumanLoadChangesDto,
  HumanLoadDto,
  InsightsPeopleDto,
  PersonUseDto,
} from '@outcomes/application/dto/insights.dto';
import {
  ChangeResponseDto,
  changeResponseOf,
  InsightsPeriodResponseDto,
  SpreadResponseDto,
} from '@outcomes/presentation/http/dto/insights-common.response.dto';

export class HumanLoadResponseDto {
  @ApiProperty({
    example: 9,
    description: 'Times a station put a task to a person in the inbox',
  })
  readonly asks: number;

  @ApiProperty({ example: 21, description: 'Tasks worked in the period' })
  readonly tasks: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.43 })
  readonly asksPerTask: number | null;

  @ApiProperty({
    type: SpreadResponseDto,
    description: 'From an ask to the person’s answer',
  })
  readonly toAnswer: SpreadResponseDto;

  @ApiProperty({ example: 1 })
  readonly unanswered: number;

  @ApiProperty({
    example: 4,
    description: 'Runs a person next sent back or refused',
  })
  readonly sentBack: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.12 })
  readonly sentBackRate: number | null;

  @ApiProperty({
    example: 2,
    description: 'Tool approvals and permissions people refused',
  })
  readonly refused: number;

  @ApiProperty({ type: String, isArray: true })
  readonly askedTaskIds: readonly string[];

  @ApiProperty({ type: String, isArray: true })
  readonly refusedTaskIds: readonly string[];

  constructor(load: HumanLoadDto) {
    this.asks = load.asks;
    this.tasks = load.tasks;
    this.asksPerTask = load.asksPerTask;
    this.toAnswer = new SpreadResponseDto(load.toAnswer);
    this.unanswered = load.unanswered;
    this.sentBack = load.sentBack;
    this.sentBackRate = load.sentBackRate;
    this.refused = load.refused;
    this.askedTaskIds = load.askedTaskIds;
    this.refusedTaskIds = load.refusedTaskIds;
  }
}

export class HumanLoadChangesResponseDto {
  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Inbox asks per task against the period before',
  })
  readonly asksPerTask: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'The median time to answer against the period before',
  })
  readonly toAnswer: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'The sent-back rate against the period before, in points',
  })
  readonly sentBackRate: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Refused approvals against the period before',
  })
  readonly refused: ChangeResponseDto | null;

  constructor(changes: HumanLoadChangesDto) {
    this.asksPerTask = changeResponseOf(changes.asksPerTask);
    this.toAnswer = changeResponseOf(changes.toAnswer);
    this.sentBackRate = changeResponseOf(changes.sentBackRate);
    this.refused = changeResponseOf(changes.refused);
  }
}

export class PersonUseResponseDto {
  @ApiProperty({ example: 'user_ada' })
  readonly personId: string;

  @ApiProperty({ nullable: true, type: String, example: 'Ada Lovelace' })
  readonly name: string | null;

  @ApiProperty({ example: 3 })
  readonly tasksOpened: number;

  @ApiProperty({
    example: 12,
    description: 'Moves, answers, approvals, refusals and sends-back',
  })
  readonly acts: number;

  @ApiProperty({ example: 2, description: 'Agent chats they started' })
  readonly chats: number;

  @ApiProperty({
    example: '2026-09-12T08:00:00.000Z',
    description: 'The first time they did anything on the team',
  })
  readonly firstSeenAt: string;

  @ApiProperty({ example: '2026-09-30T16:00:00.000Z' })
  readonly lastActiveAt: string;

  @ApiProperty({
    description: 'They first did anything on the team this period',
  })
  readonly isNew: boolean;

  constructor(use: PersonUseDto) {
    this.personId = use.personId;
    this.name = use.name;
    this.tasksOpened = use.tasksOpened;
    this.acts = use.acts;
    this.chats = use.chats;
    this.firstSeenAt = use.firstSeenAt;
    this.lastActiveAt = use.lastActiveAt;
    this.isNew = use.isNew;
  }
}

export class AdoptionResponseDto {
  @ApiProperty({ example: 5, description: 'People active this period' })
  readonly activeCount: number;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Active people against the period before',
  })
  readonly activeChange: ChangeResponseDto | null;

  @ApiProperty({
    example: 2,
    description: 'People whose first activity on the team was this period',
  })
  readonly newAdopterCount: number;

  @ApiProperty({ example: 3, description: 'People active in the last 7 days' })
  readonly weeklyCount: number;

  @ApiProperty({
    example: 5,
    description: 'People active in the last 30 days',
  })
  readonly monthlyCount: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.6,
    description: 'Weekly over monthly active people',
  })
  readonly stickiness: number | null;

  @ApiProperty({
    type: PersonUseResponseDto,
    isArray: true,
    description: 'What each person active this period did',
  })
  readonly people: readonly PersonUseResponseDto[];

  constructor(adoption: AdoptionDto) {
    this.activeCount = adoption.activeCount;
    this.activeChange = changeResponseOf(adoption.activeChange);
    this.newAdopterCount = adoption.newAdopterCount;
    this.weeklyCount = adoption.weeklyCount;
    this.monthlyCount = adoption.monthlyCount;
    this.stickiness = adoption.stickiness;
    this.people = adoption.people.map((each) => new PersonUseResponseDto(each));
  }
}

export class InsightsPeopleResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({ type: HumanLoadResponseDto, description: 'This period' })
  readonly load: HumanLoadResponseDto;

  @ApiProperty({
    type: HumanLoadChangesResponseDto,
    description: 'How the load moved against the period before, as long',
  })
  readonly loadChanges: HumanLoadChangesResponseDto;

  @ApiProperty({ type: AdoptionResponseDto })
  readonly adoption: AdoptionResponseDto;

  constructor(people: InsightsPeopleDto) {
    this.period = new InsightsPeriodResponseDto(people.period);
    this.load = new HumanLoadResponseDto(people.load);
    this.loadChanges = new HumanLoadChangesResponseDto(people.loadChanges);
    this.adoption = new AdoptionResponseDto(people.adoption);
  }
}
