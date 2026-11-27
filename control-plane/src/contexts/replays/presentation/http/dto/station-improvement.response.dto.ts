import { ApiProperty } from '@nestjs/swagger';
import type {
  ImprovementFreshDto,
  ImprovementReplayDto,
  ImprovementRunDto,
  ImprovementScoringDto,
  ImprovementSearchDto,
  ImprovementSetDto,
  ImprovementSkipDto,
  StationImprovementDto,
} from '@replays/application/dto/station-improvement.dto';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { SEARCH_SKIP_REASONS } from '@replays/domain/value-objects/search-skip-reason';
import { SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { SEARCH_TRIGGERS } from '@replays/domain/value-objects/search-trigger';
import { SetHealthResponseDto } from '@replays/presentation/http/dto/replays.response.dto';

const RUN_PROGRESS = ['waiting', 'running', 'ended'] as const;

export class ImprovementFreshResponseDto {
  @ApiProperty({
    description:
      'How many of the set’s tasks no earlier search of the station searched on, so a search can hold them out',
  })
  readonly tasks: number;

  @ApiProperty({
    description: 'How many of its tasks a search of the set holds out',
  })
  readonly heldOutTasks: number;

  @ApiProperty({
    description: 'Whether enough tasks are fresh for a search to hold out',
  })
  readonly enough: boolean;

  constructor(fresh: ImprovementFreshDto) {
    this.tasks = fresh.tasks;
    this.heldOutTasks = fresh.heldOutTasks;
    this.enough = fresh.enough;
  }
}

export class ImprovementSetResponseDto extends SetHealthResponseDto {
  @ApiProperty({ description: 'How many distinct tasks the replay set has' })
  readonly tasks: number;

  @ApiProperty({ description: 'The fewest tasks a search needs', example: 5 })
  readonly fewestTasks: number;

  @ApiProperty({ description: 'Whether the set has the tasks a search needs' })
  readonly bigEnough: boolean;

  @ApiProperty({
    type: ImprovementFreshResponseDto,
    nullable: true,
    description:
      'Its fresh tasks against those a search holds out; null until the set has the tasks a search needs',
  })
  readonly fresh: ImprovementFreshResponseDto | null;

  @ApiProperty({
    description: 'The least gain, 0 to 1, that the line counts as better',
  })
  readonly minGain: number;

  constructor(set: ImprovementSetDto) {
    super(set);
    this.tasks = set.tasks;
    this.fewestTasks = set.fewestTasks;
    this.bigEnough = set.bigEnough;
    this.fresh = set.fresh ? new ImprovementFreshResponseDto(set.fresh) : null;
    this.minGain = set.minGain;
  }
}

export class ImprovementScoringResponseDto {
  @ApiProperty({ description: 'Whether the station has a judge' })
  readonly judge: boolean;

  @ApiProperty({ description: 'Whether the station checks its changes' })
  readonly check: boolean;

  @ApiProperty({
    description:
      'Whether a replay can score a config of the station, by its judge or its check',
  })
  readonly scores: boolean;

  constructor(scoring: ImprovementScoringDto) {
    this.judge = scoring.judge;
    this.check = scoring.check;
    this.scores = scoring.scores;
  }
}

export class ImprovementRunResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The replay run; null until it is queued',
  })
  readonly runId: string | null;

  @ApiProperty({ description: 'The past run it replays' })
  readonly originalRunId: string;

  @ApiProperty({ description: 'The task of the past run' })
  readonly taskId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The title of the task; null where it has none',
  })
  readonly taskTitle: string | null;

  @ApiProperty({ enum: RUN_PROGRESS })
  readonly progress: (typeof RUN_PROGRESS)[number];

  @ApiProperty({
    type: Boolean,
    nullable: true,
    description: 'Whether it succeeded; null until it ended and was scored',
  })
  readonly succeeded: boolean | null;

  constructor(run: ImprovementRunDto) {
    this.runId = run.runId;
    this.originalRunId = run.originalRunId;
    this.taskId = run.taskId;
    this.taskTitle = run.taskTitle;
    this.progress = run.progress;
    this.succeeded = run.succeeded;
  }
}

export class ImprovementReplayResponseDto {
  @ApiProperty()
  readonly replayId: string;

  @ApiProperty({
    description: 'The name of the config it replays',
    example: 'terse',
  })
  readonly candidate: string;

  @ApiProperty({ description: 'Whether it replays the live config' })
  readonly live: boolean;

  @ApiProperty({ enum: REPLAY_STATES })
  readonly state: string;

  @ApiProperty({ type: [ImprovementRunResponseDto] })
  readonly runs: readonly ImprovementRunResponseDto[];

  constructor(replay: ImprovementReplayDto) {
    this.replayId = replay.replayId;
    this.candidate = replay.candidate;
    this.live = replay.live;
    this.state = replay.state;
    this.runs = replay.runs.map((each) => new ImprovementRunResponseDto(each));
  }
}

export class ImprovementSearchResponseDto {
  @ApiProperty()
  readonly searchId: string;

  @ApiProperty({ enum: SEARCH_STATES })
  readonly state: string;

  @ApiProperty({ enum: SEARCH_TRIGGERS })
  readonly trigger: string;

  @ApiProperty({ example: '2026-11-27T10:00:00.000Z' })
  readonly startedAt: string;

  @ApiProperty({ type: String, nullable: true })
  readonly endedAt: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'What the search came to, in words; null while it runs',
  })
  readonly result: string | null;

  @ApiProperty({
    type: [ImprovementReplayResponseDto],
    description: 'Its replays, oldest first, each with its runs',
  })
  readonly replays: readonly ImprovementReplayResponseDto[];

  constructor(search: ImprovementSearchDto) {
    this.searchId = search.searchId;
    this.state = search.state;
    this.trigger = search.trigger;
    this.startedAt = search.startedAt;
    this.endedAt = search.endedAt;
    this.result = search.result;
    this.replays = search.replays.map(
      (each) => new ImprovementReplayResponseDto(each),
    );
  }
}

export class ImprovementSkipResponseDto {
  @ApiProperty({ enum: SEARCH_SKIP_REASONS })
  readonly reason: string;

  @ApiProperty({ example: '2026-11-27T10:00:00.000Z' })
  readonly at: string;

  @ApiProperty({ description: 'Why Spotlight skipped the search, in words' })
  readonly text: string;

  @ApiProperty({
    example: '2026-11-28T10:00:00.000Z',
    description: 'When Spotlight looks again at starting a search',
  })
  readonly retryAt: string;

  constructor(skip: ImprovementSkipDto) {
    this.reason = skip.reason;
    this.at = skip.at;
    this.text = skip.text;
    this.retryAt = skip.retryAt;
  }
}

export class StationImprovementResponseDto {
  @ApiProperty({
    type: ImprovementSetResponseDto,
    nullable: true,
    description: 'The station’s replay set; null until the station has one',
  })
  readonly set: ImprovementSetResponseDto | null;

  @ApiProperty({
    type: ImprovementScoringResponseDto,
    nullable: true,
    description: 'How a replay scores the live config; null without one',
  })
  readonly scoring: ImprovementScoringResponseDto | null;

  @ApiProperty({
    type: ImprovementSearchResponseDto,
    nullable: true,
    description: 'The station’s newest search; null before its first',
  })
  readonly lastSearch: ImprovementSearchResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'When the next search of the station is due; null while search is off, while a search is in progress or awaits its result, or while the last due search was skipped',
  })
  readonly nextSearchAt: string | null;

  @ApiProperty({
    type: ImprovementSkipResponseDto,
    nullable: true,
    description:
      'Why Spotlight last skipped a due search; null when a search started since, or while search is off',
  })
  readonly lastSkip: ImprovementSkipResponseDto | null;

  constructor(improvement: StationImprovementDto) {
    this.set = improvement.set
      ? new ImprovementSetResponseDto(improvement.set)
      : null;
    this.scoring = improvement.scoring
      ? new ImprovementScoringResponseDto(improvement.scoring)
      : null;
    this.lastSearch = improvement.lastSearch
      ? new ImprovementSearchResponseDto(improvement.lastSearch)
      : null;
    this.nextSearchAt = improvement.nextSearchAt;
    this.lastSkip = improvement.lastSkip
      ? new ImprovementSkipResponseDto(improvement.lastSkip)
      : null;
  }
}
