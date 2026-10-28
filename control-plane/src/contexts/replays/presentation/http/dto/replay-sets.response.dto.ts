import { ApiProperty } from '@nestjs/swagger';
import type {
  BalanceWarningDto,
  OriginCountDto,
  OutcomeCountDto,
  RefreshedRunDto,
  ReplaySetDto,
  ReplaySetEntryDto,
  SearchScheduleDto,
  SearchSkipDto,
  SetCompositionDto,
  SetRefreshDto,
} from '@replays/application/dto/replays.dto';
import {
  ORIGINAL_OUTCOMES,
  type OriginalOutcome,
} from '@replays/domain/services/composition';
import { SEARCH_SKIP_REASONS } from '@replays/domain/value-objects/search-skip-reason';
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
      'Where its task came from: person when a person created it at this station, the integration whose happening opened it here, as in slack or github, or station when another station passed it on; null once the task is deleted',
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

export class RefreshedRunResponseDto {
  @ApiProperty({ example: '9b2f6c1e-4d3a-4e8b-a7f0-2c5d1e9b3a64' })
  readonly runId: string;

  @ApiProperty({ nullable: true, type: String, example: 'Drain the queue' })
  readonly title: string | null;

  constructor(run: RefreshedRunDto) {
    this.runId = run.runId;
    this.title = run.title;
  }
}

export class SetRefreshResponseDto {
  @ApiProperty({ example: '2026-10-08T09:00:00.000Z' })
  readonly at: string;

  @ApiProperty({
    type: RefreshedRunResponseDto,
    isArray: true,
    description: 'Runs the refresh added: the newest run of new tasks',
  })
  readonly added: RefreshedRunResponseDto[];

  @ApiProperty({
    type: RefreshedRunResponseDto,
    isArray: true,
    description:
      'Runs the refresh took out: runs that ended more than 90 days ago. The refresh then adds new runs until the set holds 30',
  })
  readonly removed: RefreshedRunResponseDto[];

  constructor(refresh: SetRefreshDto) {
    this.at = refresh.at;
    this.added = refresh.added.map((each) => new RefreshedRunResponseDto(each));
    this.removed = refresh.removed.map(
      (each) => new RefreshedRunResponseDto(each),
    );
  }
}

export class SearchSkipResponseDto {
  @ApiProperty({
    enum: SEARCH_SKIP_REASONS,
    description:
      'Why Spotlight did not start an automatic search of the station: the policy is off, the set cannot score or is too small, set health warns, no fresh held-out tasks, the ceiling is too low, no agent, the monthly ceiling, an open config pull request, or the cooldown',
  })
  readonly reason: string;

  @ApiProperty({ description: 'When Spotlight first skipped for this reason' })
  readonly at: string;

  constructor(skip: SearchSkipDto) {
    this.reason = skip.reason;
    this.at = skip.at;
  }
}

export class SearchScheduleResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly lastStartedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: SearchSkipResponseDto,
    description: 'The last skip; null once a search starts',
  })
  readonly lastSkip: SearchSkipResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-10-28T09:00:00.000Z',
    description:
      'When a config pull request of the station last merged; null if none merged',
  })
  readonly lastImprovedAt: string | null;

  @ApiProperty({
    description: 'When Spotlight next looks at the station',
  })
  readonly checkAfter: string;

  @ApiProperty({
    example: 5,
    description:
      'The fewest different tasks a set needs before Spotlight can search it',
  })
  readonly minimumTasks: number;

  constructor(schedule: SearchScheduleDto) {
    this.lastStartedAt = schedule.lastStartedAt;
    this.lastSkip =
      schedule.lastSkip && new SearchSkipResponseDto(schedule.lastSkip);
    this.lastImprovedAt = schedule.lastImprovedAt;
    this.checkAfter = schedule.checkAfter;
    this.minimumTasks = schedule.minimumTasks;
  }
}

export class ReplaySetResponseDto {
  @ApiProperty({ example: '1c7e9a2b-5d4f-4b8e-a3c6-0f2d9e7b1a58' })
  readonly id: string;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-10-08T09:00:00.000Z',
    description:
      'When Spotlight last refreshed the set from its station’s runs; null before the first refresh',
  })
  readonly refreshedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: SetRefreshResponseDto,
    description:
      'The last refresh that changed the set; null while no refresh changed it',
  })
  readonly lastRefresh: SetRefreshResponseDto | null;

  @ApiProperty({
    description:
      'Its station is gone from its line: it takes no more runs, starts no replays and holds no archives; runs may still be taken out',
  })
  readonly stationGone: boolean;

  @ApiProperty({
    type: SetHealthResponseDto,
    description:
      'Whether the set can tell candidates apart, read for the live config as it is now: its noise, how much of it the live config passes already, whether its judge and check return the same answer twice, and how much better the live config does when handed each run’s answer',
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

  @ApiProperty({
    nullable: true,
    type: SearchScheduleResponseDto,
    description:
      'When Spotlight last started an automatic search of the station, why it last skipped one, and when it looks next',
  })
  readonly searchSchedule: SearchScheduleResponseDto | null;

  constructor(set: ReplaySetDto) {
    this.id = set.id;
    this.lineId = set.lineId;
    this.stationId = set.stationId;
    this.createdAt = set.createdAt;
    this.refreshedAt = set.refreshedAt;
    this.lastRefresh = set.lastRefresh
      ? new SetRefreshResponseDto(set.lastRefresh)
      : null;
    this.stationGone = set.stationGone;
    this.health = new SetHealthResponseDto(set.health);
    this.minGain = set.minGain;
    this.composition = new SetCompositionResponseDto(set.composition);
    this.entries = set.entries.map(
      (each) => new ReplaySetEntryResponseDto(each),
    );
    this.searchSchedule =
      set.searchSchedule && new SearchScheduleResponseDto(set.searchSchedule);
  }
}
