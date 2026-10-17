import { ApiProperty } from '@nestjs/swagger';
import type {
  BalanceWarningDto,
  OriginCountDto,
  OutcomeCountDto,
  ReplayableRunDto,
  ReplaySetDto,
  ReplaySetEntryDto,
  SetCompositionDto,
  SuggestedRunDto,
} from '@replays/application/dto/replays.dto';
import {
  ORIGINAL_OUTCOMES,
  type OriginalOutcome,
} from '@replays/domain/services/composition';
import { UNREPLAYABLE_REASONS } from '@replays/domain/value-objects/unreplayable-reason';
import { SetHealthResponseDto } from '@replays/presentation/http/dto/replays.response.dto';

export class ReplaySetEntryResponseDto {
  @ApiProperty({ example: '9b2f6c1e-4d3a-4e8b-a7f0-2c5d1e9b3a64' })
  readonly runId: string;

  @ApiProperty({ example: '4e1a7c9d-2b5f-4a3e-9c8d-7f1b2e6a5d30' })
  readonly taskId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Drain the retry queue on restart',
    description:
      'The title of the task it worked, as it reads now; null once the task is deleted',
  })
  readonly title: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'completed',
    description:
      'The current state of the run; null where there is no such run',
  })
  readonly state: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-30T16:20:00.000Z',
    description: 'When the run ended; null while it has not',
  })
  readonly endedAt: string | null;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  readonly addedAt: string;

  @ApiProperty({
    enum: [...UNREPLAYABLE_REASONS, null],
    nullable: true,
    type: String,
    description: 'Why the run can no longer be replayed; null while it can',
  })
  readonly unreplayableReason: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly reason: string | null;

  @ApiProperty({
    enum: ORIGINAL_OUTCOMES,
    description:
      'How the original run turned out: asked when what a person did next was decide an approval it asked for; else accepted or sent back by what a person did next; else failed; else asked when it ended waiting on a person or a person answered it; else other',
  })
  readonly outcome: OriginalOutcome;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'slack',
    description:
      'Where its task came from: person when a person raised it at this station, the integration whose happening opened it here, as in slack or github, or station when another station handed it on; null once the task is deleted',
  })
  readonly origin: string | null;

  constructor(entry: ReplaySetEntryDto) {
    this.runId = entry.runId;
    this.taskId = entry.taskId;
    this.title = entry.title;
    this.state = entry.state;
    this.endedAt = entry.endedAt;
    this.addedAt = entry.addedAt;
    this.unreplayableReason = entry.unreplayableReason;
    this.reason = entry.reason;
    this.outcome = entry.outcome;
    this.origin = entry.origin;
  }
}

export class OutcomeCountResponseDto {
  @ApiProperty({ enum: ORIGINAL_OUTCOMES })
  readonly outcome: OriginalOutcome;

  @ApiProperty({ example: 4 })
  readonly count: number;

  constructor(count: OutcomeCountDto) {
    this.outcome = count.outcome;
    this.count = count.count;
  }
}

export class OriginCountResponseDto {
  @ApiProperty({ example: 'person' })
  readonly origin: string;

  @ApiProperty({ example: 4 })
  readonly count: number;

  constructor(count: OriginCountDto) {
    this.origin = count.origin;
    this.count = count.count;
  }
}

export class BalanceWarningResponseDto {
  @ApiProperty({ enum: ORIGINAL_OUTCOMES })
  readonly dominant: OriginalOutcome;

  @ApiProperty({ example: 7 })
  readonly count: number;

  @ApiProperty({ example: 8 })
  readonly entries: number;

  constructor(warning: BalanceWarningDto) {
    this.dominant = warning.dominant;
    this.count = warning.count;
    this.entries = warning.entries;
  }
}

export class SetCompositionResponseDto {
  @ApiProperty({
    type: OutcomeCountResponseDto,
    isArray: true,
    description:
      'How many of its runs turned out each way, every outcome listed in one order',
  })
  readonly outcomes: OutcomeCountResponseDto[];

  @ApiProperty({
    type: OriginCountResponseDto,
    isArray: true,
    description:
      'How many of its tasks came from each origin, the most common first',
  })
  readonly origins: OriginCountResponseDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When its oldest run ended; null while none has',
  })
  readonly oldest: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The median of when its runs ended; null while none has',
  })
  readonly median: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When its newest run ended; null while none has',
  })
  readonly newest: string | null;

  @ApiProperty({
    nullable: true,
    type: BalanceWarningResponseDto,
    description:
      'Set when one outcome is more than two thirds of a set of at least 6 runs',
  })
  readonly balanceWarning: BalanceWarningResponseDto | null;

  constructor(composition: SetCompositionDto) {
    this.outcomes = composition.outcomes.map(
      (each) => new OutcomeCountResponseDto(each),
    );
    this.origins = composition.origins.map(
      (each) => new OriginCountResponseDto(each),
    );
    this.oldest = composition.oldest;
    this.median = composition.median;
    this.newest = composition.newest;
    this.balanceWarning = composition.balanceWarning
      ? new BalanceWarningResponseDto(composition.balanceWarning)
      : null;
  }
}

export class ReplaySetResponseDto {
  @ApiProperty({ example: '1c7e9a2b-5d4f-4b8e-a3c6-0f2d9e7b1a58' })
  readonly id: string;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ example: 'Queue fixes' })
  readonly name: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({
    description:
      'Its station is gone from its line: it takes no more runs, starts no replays and keeps no archives; it may still be renamed, have runs taken out, or be deleted',
  })
  readonly stationGone: boolean;

  @ApiProperty({
    description:
      'Planned changes of its station are checked against it, as `spotlight replay check` asks; a station has at most one such set',
  })
  readonly guardsChanges: boolean;

  @ApiProperty({
    type: SetHealthResponseDto,
    description:
      'Whether the set can tell candidates apart, read for the live config as it is now: its noise, how much of it the live config passes already, whether its judge and check give the same answer twice, and how much better the live config does when handed each run’s answer',
  })
  readonly health: SetHealthResponseDto;

  @ApiProperty({
    example: 0.05,
    description:
      'The smallest gain in success its line counts as real: replay_check.min_gain, or 0.05 when the line sets none',
  })
  readonly minGain: number;

  @ApiProperty({
    type: SetCompositionResponseDto,
    description:
      'What the set is made of: how its runs turned out, where their tasks came from, and when they ended',
  })
  readonly composition: SetCompositionResponseDto;

  @ApiProperty({ type: ReplaySetEntryResponseDto, isArray: true })
  readonly entries: ReplaySetEntryResponseDto[];

  constructor(set: ReplaySetDto) {
    this.id = set.id;
    this.lineId = set.lineId;
    this.stationId = set.stationId;
    this.name = set.name;
    this.createdAt = set.createdAt;
    this.stationGone = set.stationGone;
    this.guardsChanges = set.guardsChanges;
    this.health = new SetHealthResponseDto(set.health);
    this.minGain = set.minGain;
    this.composition = new SetCompositionResponseDto(set.composition);
    this.entries = set.entries.map(
      (each) => new ReplaySetEntryResponseDto(each),
    );
  }
}

export class ReplayableRunResponseDto {
  @ApiProperty()
  readonly runId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly taskId: string | null;

  @ApiProperty({ example: 'Drain the queue' })
  readonly title: string;

  @ApiProperty({ example: 'completed' })
  readonly state: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  readonly endedAt: string;

  @ApiProperty({
    enum: [...UNREPLAYABLE_REASONS, null],
    nullable: true,
    type: String,
    description: 'Why it cannot be replayed; null when it can',
  })
  readonly unreplayableReason: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly reason: string | null;

  constructor(run: ReplayableRunDto) {
    this.runId = run.runId;
    this.taskId = run.taskId;
    this.title = run.title;
    this.state = run.state;
    this.endedAt = run.endedAt;
    this.unreplayableReason = run.unreplayableReason;
    this.reason = run.reason;
  }
}

export class SuggestedRunResponseDto extends ReplayableRunResponseDto {
  @ApiProperty({
    enum: ORIGINAL_OUTCOMES,
    description: 'How the run turned out',
  })
  readonly outcome: OriginalOutcome;

  constructor(run: SuggestedRunDto) {
    super(run);
    this.outcome = run.outcome;
  }
}

export class OpenReplaySetRequestDto {
  @ApiProperty({ example: 'Queue fixes', minLength: 1, maxLength: 100 })
  readonly name!: string;
}

export class RenameReplaySetRequestDto {
  @ApiProperty({
    example: 'Queue fixes, hard ones',
    minLength: 1,
    maxLength: 100,
  })
  readonly name!: string;
}

export class AddReplaySetEntryRequestDto {
  @ApiProperty({
    example: '9b2f6c1e-4d3a-4e8b-a7f0-2c5d1e9b3a64',
    description: 'A past run of a task at the set’s station',
  })
  readonly runId!: string;
}

export class ReplaySetOpenedResponseDto {
  @ApiProperty()
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
}
