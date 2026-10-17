import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  type ApiPropertyOptions,
  getSchemaPath,
} from '@nestjs/swagger';
import type { SearchCauseRecorded } from '@replays/application/dto/replay-outcomes.dto';
import type {
  OnlyOnSeenTasksDto,
  ReflectedTaskDto,
  SearchAgentDto,
  SearchAllotmentsDto,
  SearchBestDto,
  SearchBudgetDto,
  SearchCandidateDto,
  SearchCauseDto,
  SearchDetailDto,
  SearchEstimateDto,
  SearchIterationDto,
  SearchReflectionDto,
  SearchRunsEstimateDto,
  SearchSplitDto,
  SearchSplitEntryDto,
  SearchSummaryDto,
  SearchWarningDto,
} from '@replays/application/dto/searches.dto';
import { ONLY_ON_SEEN_TASKS } from '@replays/domain/services/overfit';
import { REFLECTION_OUTCOMES } from '@replays/domain/value-objects/reflection-outcome';
import { MAX_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import {
  MAX_CONCURRENCY,
  MAX_ITERATIONS,
  MAX_PER_ITERATION,
  SEARCH_CONCURRENCY,
} from '@replays/domain/value-objects/search-budget.vo';
import {
  MAX_CAUSE_TEXT,
  SEARCH_CAUSES,
} from '@replays/domain/value-objects/search-cause.vo';
import { SEARCH_ENDINGS } from '@replays/domain/value-objects/search-ending';
import {
  SEARCH_ITERATION_KINDS,
  SEARCH_ITERATION_STATES,
} from '@replays/domain/value-objects/search-iteration.vo';
import { SEARCH_OBJECTIVES } from '@replays/domain/value-objects/search-objective';
import { SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { CandidatePullRequestResponseDto } from '@replays/presentation/http/dto/config-pull-requests.response.dto';
import { StationChangeResponseDto } from '@replays/presentation/http/dto/replay-candidate-resource.response.dto';
import {
  GainReadingResponseDto,
  gainResponse,
  intervalResponse,
  ModelSpentResponseDto,
  PairTallyResponseDto,
  RateIntervalResponseDto,
  SpendResponseDto,
  StartReplayCeilingRequestDto,
} from '@replays/presentation/http/dto/replays.response.dto';

const SEARCH_CANDIDATE_SLUG =
  'lowercase letters, digits and hyphens, starting with a letter or digit, at most 63 characters';

const ONLY_ON_SEEN_TASKS_PROPERTY: ApiPropertyOptions = {
  enum: [...ONLY_ON_SEEN_TASKS, null],
  nullable: true,
  type: String,
  description:
    'marked when it beat the live config on the searched tasks but not on the held-out ones, so its gain showed only on the tasks the search could see; too-few-held-out when it beat the live config on the searched tasks but too few held-out tasks were scored on both sides to tell; null otherwise, and until its held-out replay finished',
};
export class SearchAgentRequestDto {
  @ApiProperty({
    example: 'claude-code',
    description: 'The harness the search’s agent runs on',
  })
  readonly harness!: string;

  @ApiPropertyOptional({
    example: 'claude-opus-4-5',
    nullable: true,
    type: String,
  })
  readonly model?: string | null;

  @ApiPropertyOptional({
    example: 'high',
    nullable: true,
    type: String,
    enum: ['low', 'medium', 'high', 'xhigh', 'max'],
  })
  readonly effort?: string | null;
}

export class SearchBudgetRequestDto {
  @ApiProperty({
    example: 3,
    minimum: 1,
    maximum: MAX_ITERATIONS,
    description: 'How many times the search runs its agent',
  })
  readonly iterations!: number;

  @ApiProperty({
    example: 2,
    minimum: 1,
    maximum: MAX_PER_ITERATION,
    description: 'How many candidates each agent run may propose',
  })
  readonly perIteration!: number;

  @ApiProperty({
    type: StartReplayCeilingRequestDto,
    description:
      'The most the whole search may spend: its replays and its agent’s runs',
  })
  readonly ceiling!: StartReplayCeilingRequestDto;

  @ApiPropertyOptional({
    example: SEARCH_CONCURRENCY,
    minimum: 1,
    maximum: MAX_CONCURRENCY,
    description: `How many of its replay runs it runs at once, beside the team’s own; ${SEARCH_CONCURRENCY} unless told`,
  })
  readonly concurrency?: number;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: MAX_REPEATS,
    description:
      'How many times each of its replays replays each run: the seed, every candidate and the held-out replays; 1 unless told. Runs and cost grow with it',
  })
  readonly repeats?: number;
}

class NoiseUnmeasuredWarningResponseDto {
  @ApiProperty({
    enum: ['noise-unmeasured'],
    description:
      'No finished replay of the live config ran the set more than once, so nobody knows how much its success moves by chance',
  })
  readonly kind = 'noise-unmeasured' as const;
}

class NoisyWarningResponseDto {
  @ApiProperty({
    enum: ['noisy'],
    description:
      'The set’s success moves more between copies than the line’s min_gain, so a single copy cannot tell a real gain from noise',
  })
  readonly kind = 'noisy' as const;

  @ApiProperty({
    example: 0.12,
    description: 'How far the set’s success moved between copies',
  })
  readonly spread: number;

  @ApiProperty({ example: 0.05 })
  readonly minGain: number;

  @ApiProperty({
    example: 6,
    description:
      'The repeats it would take to bring the noise under min_gain, however many; more than 5 means no search of this set can tell such a gain from noise',
  })
  readonly neededRepeats: number;

  @ApiProperty({
    example: 5,
    description: 'The repeats to ask for: the needed ones, at most 5',
  })
  readonly suggestedRepeats: number;

  constructor(warning: Extract<SearchWarningDto, { kind: 'noisy' }>) {
    this.spread = warning.spread;
    this.minGain = warning.minGain;
    this.neededRepeats = warning.neededRepeats;
    this.suggestedRepeats = warning.suggestedRepeats;
  }
}

class SaturatedWarningResponseDto {
  @ApiProperty({
    enum: ['saturated'],
    description:
      'The live config passes more than 95% of the set already, so a search for more success has little room; a search for the same success at less cost does',
  })
  readonly kind = 'saturated' as const;

  @ApiProperty({
    example: 0.97,
    description: 'The live config’s success on the set',
  })
  readonly rate: number;

  constructor(warning: Extract<SearchWarningDto, { kind: 'saturated' }>) {
    this.rate = warning.rate;
  }
}

class JudgeUnstableWarningResponseDto {
  @ApiProperty({
    enum: ['judge-unstable'],
    description:
      'The judge, asked twice of the same change, passed or failed it alike less than 80% of the time, so its verdicts are partly chance',
  })
  readonly kind = 'judge-unstable' as const;

  @ApiProperty({
    example: 0.7,
    description: 'The share of changes it passed or failed alike both times',
  })
  readonly agreement: number;

  @ApiProperty({ example: 12, description: 'How many changes it judged twice' })
  readonly compared: number;

  constructor(warning: Extract<SearchWarningDto, { kind: 'judge-unstable' }>) {
    this.agreement = warning.agreement;
    this.compared = warning.compared;
  }
}

class FlakyChecksWarningResponseDto {
  @ApiProperty({
    enum: ['flaky-checks'],
    description:
      'The station’s check, run twice on the same change, passed one time and failed the other on some tasks',
  })
  readonly kind = 'flaky-checks' as const;

  @ApiProperty({ example: 2, description: 'How many changes it flipped on' })
  readonly flaky: number;

  @ApiProperty({
    example: 12,
    description: 'How many changes it checked twice',
  })
  readonly rechecked: number;

  constructor(warning: Extract<SearchWarningDto, { kind: 'flaky-checks' }>) {
    this.flaky = warning.flaky;
    this.rechecked = warning.rechecked;
  }
}

class NoHeadroomWarningResponseDto {
  @ApiProperty({
    enum: ['no-headroom'],
    description:
      'Handed each run’s answer, the live config did not do clearly better, so the set leaves little room for a better config to show',
  })
  readonly kind = 'no-headroom' as const;

  @ApiProperty({
    example: 0.02,
    description: 'The gain in success the answer brought',
  })
  readonly gain: number;

  @ApiProperty({ example: -0.15 })
  readonly low: number;

  @ApiProperty({ example: 0.1 })
  readonly high: number;

  @ApiProperty({
    example: 6,
    description: 'How many runs were handed an answer',
  })
  readonly answered: number;

  constructor(warning: Extract<SearchWarningDto, { kind: 'no-headroom' }>) {
    this.gain = warning.gain;
    this.low = warning.low;
    this.high = warning.high;
    this.answered = warning.answered;
  }
}

type SearchWarningResponseDto =
  | NoiseUnmeasuredWarningResponseDto
  | NoisyWarningResponseDto
  | SaturatedWarningResponseDto
  | JudgeUnstableWarningResponseDto
  | FlakyChecksWarningResponseDto
  | NoHeadroomWarningResponseDto;

const warningResponse = (
  warning: SearchWarningDto,
): SearchWarningResponseDto => {
  switch (warning.kind) {
    case 'noisy':
      return new NoisyWarningResponseDto(warning);
    case 'saturated':
      return new SaturatedWarningResponseDto(warning);
    case 'judge-unstable':
      return new JudgeUnstableWarningResponseDto(warning);
    case 'flaky-checks':
      return new FlakyChecksWarningResponseDto(warning);
    case 'no-headroom':
      return new NoHeadroomWarningResponseDto(warning);
    default:
      return new NoiseUnmeasuredWarningResponseDto();
  }
};

const WARNINGS_SCHEMA: ApiPropertyOptions = {
  type: 'array',
  items: {
    oneOf: [
      { $ref: getSchemaPath(NoiseUnmeasuredWarningResponseDto) },
      { $ref: getSchemaPath(NoisyWarningResponseDto) },
      { $ref: getSchemaPath(SaturatedWarningResponseDto) },
      { $ref: getSchemaPath(JudgeUnstableWarningResponseDto) },
      { $ref: getSchemaPath(FlakyChecksWarningResponseDto) },
      { $ref: getSchemaPath(NoHeadroomWarningResponseDto) },
    ],
    discriminator: {
      propertyName: 'kind',
      mapping: {
        'noise-unmeasured': getSchemaPath(NoiseUnmeasuredWarningResponseDto),
        noisy: getSchemaPath(NoisyWarningResponseDto),
        saturated: getSchemaPath(SaturatedWarningResponseDto),
        'judge-unstable': getSchemaPath(JudgeUnstableWarningResponseDto),
        'flaky-checks': getSchemaPath(FlakyChecksWarningResponseDto),
        'no-headroom': getSchemaPath(NoHeadroomWarningResponseDto),
      },
    },
  },
};

const WARNING_MODELS = [
  NoiseUnmeasuredWarningResponseDto,
  NoisyWarningResponseDto,
  SaturatedWarningResponseDto,
  JudgeUnstableWarningResponseDto,
  FlakyChecksWarningResponseDto,
  NoHeadroomWarningResponseDto,
];

const OBJECTIVE_SAYS =
  'success ranks candidates by how often they succeed; cost ranks those that succeed as often as the live config, within noise, by what a run costs';

export class EstimateSearchRequestDto {
  @ApiProperty({ description: 'The replay set at the station to search on' })
  readonly setId!: string;

  @ApiProperty({ type: SearchBudgetRequestDto })
  readonly budget!: SearchBudgetRequestDto;

  @ApiPropertyOptional({
    enum: SEARCH_OBJECTIVES,
    description: `What the search looks for: ${OBJECTIVE_SAYS}. Left out, cost on a set the live config saturates, else success`,
  })
  readonly objective?: 'success' | 'cost';
}

export class StartSearchRequestDto extends EstimateSearchRequestDto {
  @ApiProperty({ type: SearchAgentRequestDto })
  readonly agent!: SearchAgentRequestDto;
}

@ApiExtraModels(...WARNING_MODELS)
export class SearchStartedResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({
    description:
      'The replay of the live config over the whole set, the search starts from; its agent runs once it ends',
  })
  readonly seedReplayId: string;

  @ApiProperty({
    enum: SEARCH_OBJECTIVES,
    description: `What the search looks for: ${OBJECTIVE_SAYS}`,
  })
  readonly objective: 'success' | 'cost';

  @ApiProperty({
    ...WARNINGS_SCHEMA,
    description:
      'What makes its results hard to trust; the search starts all the same',
  })
  readonly warnings: SearchWarningResponseDto[];

  constructor(started: {
    readonly id: string;
    readonly seedReplayId: string;
    readonly objective: 'success' | 'cost';
    readonly warnings: readonly SearchWarningDto[];
  }) {
    this.id = started.id;
    this.seedReplayId = started.seedReplayId;
    this.objective = started.objective;
    this.warnings = started.warnings.map(warningResponse);
  }
}

export class SearchAgentResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ nullable: true, type: String })
  readonly model: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly effort: string | null;

  constructor(agent: SearchAgentDto) {
    this.harness = agent.harness;
    this.model = agent.model;
    this.effort = agent.effort;
  }
}

export class SearchBudgetResponseDto {
  @ApiProperty({ example: 3 })
  readonly iterations: number;

  @ApiProperty({ example: 2 })
  readonly perIteration: number;

  @ApiProperty({ type: SpendResponseDto })
  readonly ceiling: SpendResponseDto;

  @ApiProperty({ example: SEARCH_CONCURRENCY })
  readonly concurrency: number;

  @ApiProperty({
    example: 1,
    description: 'How many times each of its replays replays each run',
  })
  readonly repeats: number;

  constructor(budget: SearchBudgetDto) {
    this.iterations = budget.iterations;
    this.perIteration = budget.perIteration;
    this.ceiling = new SpendResponseDto(budget.ceiling);
    this.concurrency = budget.concurrency;
    this.repeats = budget.repeats;
  }
}

export class SearchBestResponseDto {
  @ApiProperty()
  readonly candidateId: string;

  @ApiProperty({ example: 'terse-prompt' })
  readonly name: string;

  @ApiProperty({
    description: 'Whether nothing the search found beat the live config',
  })
  readonly seed: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Its success rate on the searched tasks, 0 to 1',
  })
  readonly searchScore: number | null;

  @ApiProperty({
    type: RateIntervalResponseDto,
    nullable: true,
    description: 'Its success rate on the searched tasks with its 95% interval',
  })
  readonly searchInterval: RateIntervalResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Its success rate on the held-out tasks, 0 to 1, once they are replayed',
  })
  readonly heldOutScore: number | null;

  @ApiProperty({
    type: RateIntervalResponseDto,
    nullable: true,
    description: 'Its held-out success rate with its 95% interval',
  })
  readonly heldOutInterval: RateIntervalResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'What it spent per searched run, in the search’s currency; unknown while any of its spend went unpriced or was in another currency',
  })
  readonly costPerRun: number | null;

  @ApiProperty(ONLY_ON_SEEN_TASKS_PROPERTY)
  readonly onlyOnSeenTasks: OnlyOnSeenTasksDto | null;

  constructor(best: SearchBestDto) {
    this.candidateId = best.candidateId;
    this.name = best.name;
    this.seed = best.seed;
    this.searchScore = best.searchScore;
    this.searchInterval = intervalResponse(best.searchInterval);
    this.heldOutScore = best.heldOutScore;
    this.heldOutInterval = intervalResponse(best.heldOutInterval);
    this.costPerRun = best.costPerRun;
    this.onlyOnSeenTasks = best.onlyOnSeenTasks;
  }
}

export class SearchResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty()
  readonly setId: string;

  @ApiProperty({
    enum: SEARCH_STATES,
    description:
      'seeding while the live config is replayed, searching while its agent proposes candidates, holding-out while the best are replayed on the held-out tasks, then finished or stopped',
  })
  readonly state: string;

  @ApiProperty({
    nullable: true,
    enum: [...SEARCH_ENDINGS, null],
    type: String,
    description:
      'Why it stopped searching: it ran its iterations, reached its ceiling, stalled after two propose iterations in a row found nothing better (with or without a reflection, whose outcome says why), was stopped by a person, lost its station or set, or could not replay the live config',
  })
  readonly ending: string | null;

  @ApiProperty({ type: SearchAgentResponseDto })
  readonly agent: SearchAgentResponseDto;

  @ApiProperty({ type: SearchBudgetResponseDto })
  readonly budget: SearchBudgetResponseDto;

  @ApiProperty({
    enum: SEARCH_OBJECTIVES,
    description: `What it looks for, which orders its frontier and its best: ${OBJECTIVE_SAYS}`,
  })
  readonly objective: 'success' | 'cost';

  @ApiProperty({
    type: SpendResponseDto,
    description:
      'What it spent so far, in its ceiling’s currency: its replays and its agent’s runs',
  })
  readonly spent: SpendResponseDto;

  @ApiProperty({ description: 'How many times its agent ran, or is running' })
  readonly iterationsRun: number;

  @ApiProperty({ description: 'How many candidates its agent proposed' })
  readonly proposed: number;

  @ApiProperty({
    nullable: true,
    type: SearchBestResponseDto,
    description:
      'The best candidate by its objective, on its held-out score where it has one, else its search score: the one that succeeds most, or the cheapest that succeeds as often as the live config within noise; the live config when nothing beat it',
  })
  readonly best: SearchBestResponseDto | null;

  @ApiProperty()
  readonly startedAt: string;

  @ApiProperty({ nullable: true, type: String })
  readonly endedAt: string | null;

  constructor(search: SearchSummaryDto) {
    this.id = search.id;
    this.lineId = search.lineId;
    this.stationId = search.stationId;
    this.setId = search.setId;
    this.state = search.state;
    this.ending = search.ending;
    this.agent = new SearchAgentResponseDto(search.agent);
    this.budget = new SearchBudgetResponseDto(search.budget);
    this.objective = search.objective;
    this.spent = new SpendResponseDto(search.spent);
    this.iterationsRun = search.iterationsRun;
    this.proposed = search.proposed;
    this.best = search.best ? new SearchBestResponseDto(search.best) : null;
    this.startedAt = search.startedAt;
    this.endedAt = search.endedAt;
  }
}

export class SearchSplitEntryResponseDto {
  @ApiProperty()
  readonly runId: string;

  @ApiProperty()
  readonly taskId: string;

  constructor(entry: SearchSplitEntryDto) {
    this.runId = entry.runId;
    this.taskId = entry.taskId;
  }
}

export class SearchSplitResponseDto {
  @ApiProperty({ example: 7 })
  readonly searchedTasks: number;

  @ApiProperty({ example: 3 })
  readonly heldOutTasks: number;

  @ApiProperty({
    type: SearchSplitEntryResponseDto,
    isArray: true,
    description: 'The set’s runs its agent sees and its candidates replay',
  })
  readonly searched: SearchSplitEntryResponseDto[];

  @ApiProperty({
    type: SearchSplitEntryResponseDto,
    isArray: true,
    description:
      'The set’s runs its agent never sees, replayed only for the best candidates once it stops searching',
  })
  readonly heldOut: SearchSplitEntryResponseDto[];

  constructor(split: SearchSplitDto) {
    this.searchedTasks = split.searchedTasks;
    this.heldOutTasks = split.heldOutTasks;
    this.searched = split.searched.map(
      (each) => new SearchSplitEntryResponseDto(each),
    );
    this.heldOut = split.heldOut.map(
      (each) => new SearchSplitEntryResponseDto(each),
    );
  }
}

export class ReflectedTaskResponseDto {
  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({ description: 'The run the set contains for the task' })
  readonly originalRunId: string;

  @ApiProperty({
    description:
      'The replay run that failed it, of the best config so far, to link to',
  })
  readonly replayRunId: string;

  constructor(task: ReflectedTaskDto) {
    this.taskId = task.taskId;
    this.originalRunId = task.originalRunId;
    this.replayRunId = task.replayRunId;
  }
}

export class SearchCauseResponseDto extends ReflectedTaskResponseDto {
  @ApiProperty({
    enum: SEARCH_CAUSES,
    description:
      'config when a change to the station’s config could fix it; task when the task itself is why; judge when the judge scored it wrong; check when the check failed for a reason the change did not cause; infra when the run failed around the work',
  })
  readonly cause: string;

  @ApiProperty({ description: 'What in the runs shows the cause' })
  readonly evidence: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What to change, as the agent suggests it',
  })
  readonly suggestion: string | null;

  @ApiProperty()
  readonly recordedAt: string;

  constructor(cause: SearchCauseDto) {
    super(cause);
    this.cause = cause.cause;
    this.evidence = cause.evidence;
    this.suggestion = cause.suggestion;
    this.recordedAt = cause.recordedAt;
  }
}

export class SearchReflectionResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The candidate whose failures it looked into: the best config before it, the seed’s id when nothing beat the live config; none until it looked',
  })
  readonly standing: string | null;

  @ApiProperty({
    type: ReflectedTaskResponseDto,
    isArray: true,
    description:
      'The searched tasks the best config so far still failed, which it looked into; never a held-out one',
  })
  readonly tasks: ReflectedTaskResponseDto[];

  @ApiProperty({
    type: SearchCauseResponseDto,
    isArray: true,
    description: 'One cause for each task it recorded one for',
  })
  readonly causes: SearchCauseResponseDto[];

  @ApiProperty({
    nullable: true,
    enum: [...REFLECTION_OUTCOMES, null],
    type: String,
    description:
      'How it ended, once it did: went-on when it found a cause the config can fix and the search carried on; no-config-cause when it found none; no-failures when no searched task failed, so it never ran; did-not-run when its run failed before recording a cause; out-of-budget when it found a config cause but the search had no budget left to try it',
  })
  readonly outcome: string | null;

  @ApiProperty({
    description:
      'True when the search stopped searching once it ended, for whatever outcome other than went-on',
  })
  readonly endedSearch: boolean;

  constructor(reflection: SearchReflectionDto) {
    this.standing = reflection.standing;
    this.outcome = reflection.outcome;
    this.tasks = reflection.tasks.map(
      (each) => new ReflectedTaskResponseDto(each),
    );
    this.causes = reflection.causes.map(
      (each) => new SearchCauseResponseDto(each),
    );
    this.endedSearch = reflection.endedSearch;
  }
}

export class SearchIterationResponseDto {
  @ApiProperty({ example: 1 })
  readonly number: number;

  @ApiProperty({
    enum: SEARCH_ITERATION_KINDS,
    description:
      'propose when its agent proposes candidates; reflect when, after two propose iterations in a row found nothing better than the best before them, its agent looks into why the remaining tasks fail',
  })
  readonly kind: string;

  @ApiProperty({ description: 'The agent run of this iteration' })
  readonly runId: string;

  @ApiProperty({
    enum: SEARCH_ITERATION_STATES,
    description:
      'wanted until its run is queued, running while its run is, then ended, or failed when its run failed, asked a person or could not start',
  })
  readonly state: string;

  @ApiProperty({
    description:
      'How many candidates it tried to propose, those refused included',
  })
  readonly attempts: number;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The candidates it proposed, by id',
  })
  readonly proposed: string[];

  @ApiProperty({
    nullable: true,
    type: ModelSpentResponseDto,
    description: 'What its agent run spent, once digested',
  })
  readonly agentSpent: ModelSpentResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: SearchReflectionResponseDto,
    description: 'What a reflect iteration looked into and found',
  })
  readonly reflection: SearchReflectionResponseDto | null;

  constructor(iteration: SearchIterationDto) {
    this.number = iteration.number;
    this.kind = iteration.kind;
    this.runId = iteration.runId;
    this.state = iteration.state;
    this.attempts = iteration.attempts;
    this.proposed = [...iteration.proposed];
    this.agentSpent = iteration.agentSpent
      ? new ModelSpentResponseDto(iteration.agentSpent)
      : null;
    this.reflection = iteration.reflection
      ? new SearchReflectionResponseDto(iteration.reflection)
      : null;
  }
}

export class SearchCandidateResponseDto {
  @ApiProperty()
  readonly candidateId: string;

  @ApiProperty({
    example: 'terse-prompt',
    description: `The slug its agent named it by (${SEARCH_CANDIDATE_SLUG}); seed for the live config it started from`,
  })
  readonly name: string;

  @ApiProperty({ description: 'Whether it is the live config it started from' })
  readonly seed: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'The iteration that proposed it; none for the seed',
  })
  readonly iteration: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What its agent expected it to improve, and why',
  })
  readonly hypothesis: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly fingerprint: string | null;

  @ApiProperty({
    type: StationChangeResponseDto,
    isArray: true,
    description: 'How its station config differs from the live config',
  })
  readonly changes: StationChangeResponseDto[];

  @ApiProperty({
    description:
      'Its replay on the searched tasks; for the seed, its replay of the whole set',
  })
  readonly replayId: string;

  @ApiProperty({ nullable: true, enum: [...REPLAY_STATES, null], type: String })
  readonly replayState: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Its replay on the held-out tasks, when it was on the frontier as the search stopped',
  })
  readonly heldOutReplayId: string | null;

  @ApiProperty({ nullable: true, enum: [...REPLAY_STATES, null], type: String })
  readonly heldOutReplayState: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Its success rate on the searched tasks, 0 to 1',
  })
  readonly searchScore: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'Its success rate on the searched tasks with its 95% interval',
  })
  readonly searchInterval: RateIntervalResponseDto | null;

  @ApiProperty({
    description:
      'How many searched replay runs, copies included, it was scored on',
  })
  readonly searchScored: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Its success rate on the held-out tasks, 0 to 1, once its held-out replay finished',
  })
  readonly heldOutScore: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'Its held-out success rate with its 95% interval',
  })
  readonly heldOutInterval: RateIntervalResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: GainReadingResponseDto,
    description:
      'Its gain over the seed on the searched tasks, paired task by task, and whether it is within noise; null for the seed',
  })
  readonly searchedGain: GainReadingResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: GainReadingResponseDto,
    description:
      'Its gain over the seed on the held-out tasks, once its held-out replay finished; null for the seed',
  })
  readonly heldOutGain: GainReadingResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: PairTallyResponseDto,
    description:
      'Searched tasks whose change the judge, comparing it blind with the seed’s, found better, worse or as good; null for the seed',
  })
  readonly searchedPairs: PairTallyResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: PairTallyResponseDto,
    description:
      'Held-out tasks whose change the judge, comparing it blind with the seed’s, found better, worse or as good; null for the seed or before its held-out replay',
  })
  readonly heldOutPairs: PairTallyResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'What it spent per searched run; unknown while any of it went unpriced or was in another currency',
  })
  readonly costPerRun: number | null;

  @ApiProperty({ type: SpendResponseDto })
  readonly spent: SpendResponseDto;

  @ApiProperty({
    description:
      'Whether no other candidate, nor the seed, succeeds as often for less',
  })
  readonly onFrontier: boolean;

  @ApiProperty(ONLY_ON_SEEN_TASKS_PROPERTY)
  readonly onlyOnSeenTasks: OnlyOnSeenTasksDto | null;

  @ApiProperty({
    type: CandidatePullRequestResponseDto,
    nullable: true,
    description:
      'The pull request Spotlight opens in the line’s config repository once a person picks the candidate; null until then, and always for the seed',
  })
  readonly pullRequest: CandidatePullRequestResponseDto | null;

  constructor(candidate: SearchCandidateDto) {
    this.candidateId = candidate.candidateId;
    this.name = candidate.name;
    this.seed = candidate.seed;
    this.iteration = candidate.iteration;
    this.hypothesis = candidate.hypothesis;
    this.fingerprint = candidate.fingerprint;
    this.changes = candidate.changes.map(
      (each) => new StationChangeResponseDto(each),
    );
    this.replayId = candidate.replayId;
    this.replayState = candidate.replayState;
    this.heldOutReplayId = candidate.heldOutReplayId;
    this.heldOutReplayState = candidate.heldOutReplayState;
    this.searchScore = candidate.searchScore;
    this.searchInterval = intervalResponse(candidate.searchInterval);
    this.searchScored = candidate.searchScored;
    this.heldOutScore = candidate.heldOutScore;
    this.heldOutInterval = intervalResponse(candidate.heldOutInterval);
    this.searchedGain = gainResponse(candidate.searchedGain);
    this.heldOutGain = gainResponse(candidate.heldOutGain);
    this.searchedPairs = candidate.searchedPairs
      ? new PairTallyResponseDto(candidate.searchedPairs)
      : null;
    this.heldOutPairs = candidate.heldOutPairs
      ? new PairTallyResponseDto(candidate.heldOutPairs)
      : null;
    this.costPerRun = candidate.costPerRun;
    this.spent = new SpendResponseDto(candidate.spent);
    this.onFrontier = candidate.onFrontier;
    this.onlyOnSeenTasks = candidate.onlyOnSeenTasks;
    this.pullRequest = candidate.pullRequest
      ? new CandidatePullRequestResponseDto(candidate.pullRequest)
      : null;
  }
}

export class SearchDetailResponseDto extends SearchResponseDto {
  @ApiProperty({ type: SearchSplitResponseDto })
  readonly split: SearchSplitResponseDto;

  @ApiProperty({ type: SearchIterationResponseDto, isArray: true })
  readonly iterations: SearchIterationResponseDto[];

  @ApiProperty({
    type: SearchCandidateResponseDto,
    description:
      'The live config the search started from; its search score counts the searched tasks only, its held-out score the held-out ones',
  })
  readonly seed: SearchCandidateResponseDto;

  @ApiProperty({ type: SearchCandidateResponseDto, isArray: true })
  readonly candidates: SearchCandidateResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'The candidates no other beats on both success and cost, by id, cheapest first; the seed always among them',
  })
  readonly frontier: string[];

  @ApiProperty({
    example: 1,
    description:
      'How many frontier candidates gained only on the tasks the search could see',
  })
  readonly onlyOnSeenTasks: number;

  @ApiProperty({
    example: 0.05,
    description:
      'The smallest gain over the seed its line counts as real: replay_check.min_gain, or 0.05 when the line sets none',
  })
  readonly minGain: number;

  constructor(search: SearchDetailDto) {
    super(search);
    this.split = new SearchSplitResponseDto(search.split);
    this.iterations = search.iterations.map(
      (each) => new SearchIterationResponseDto(each),
    );
    this.seed = new SearchCandidateResponseDto(search.seed);
    this.candidates = search.candidates.map(
      (each) => new SearchCandidateResponseDto(each),
    );
    this.frontier = [...search.frontier];
    this.onlyOnSeenTasks = search.onlyOnSeenTasks;
    this.minGain = search.minGain;
  }
}

export class SearchRunsEstimateResponseDto {
  @ApiProperty({ description: 'Replay runs of the live config, one per run' })
  readonly seed: number;

  @ApiProperty({
    description:
      'Replay runs of every candidate it may propose, on the searched tasks',
  })
  readonly searchReplays: number;

  @ApiProperty({
    description: 'Replay runs of the best candidates on the held-out tasks',
  })
  readonly heldOutReplays: number;

  @ApiProperty({ description: 'Runs of its agent, one per iteration' })
  readonly agent: number;

  @ApiProperty()
  readonly total: number;

  constructor(runs: SearchRunsEstimateDto) {
    this.seed = runs.seed;
    this.searchReplays = runs.searchReplays;
    this.heldOutReplays = runs.heldOutReplays;
    this.agent = runs.agent;
    this.total = runs.total;
  }
}

export class SearchAllotmentsResponseDto {
  @ApiProperty({
    type: SpendResponseDto,
    description: 'The ceiling of its replay of the live config',
  })
  readonly seed: SpendResponseDto;

  @ApiProperty({
    type: SpendResponseDto,
    description: 'The ceiling of each candidate’s replay on searched tasks',
  })
  readonly searchReplay: SpendResponseDto;

  @ApiProperty({
    type: SpendResponseDto,
    description: 'The ceiling of each candidate’s replay on held-out tasks',
  })
  readonly heldOutReplay: SpendResponseDto;

  @ApiProperty({
    type: SpendResponseDto,
    description:
      'What each agent run is expected to spend; one may overshoot it',
  })
  readonly agentRun: SpendResponseDto;

  constructor(allotments: SearchAllotmentsDto) {
    this.seed = new SpendResponseDto(allotments.seed);
    this.searchReplay = new SpendResponseDto(allotments.searchReplay);
    this.heldOutReplay = new SpendResponseDto(allotments.heldOutReplay);
    this.agentRun = new SpendResponseDto(allotments.agentRun);
  }
}

@ApiExtraModels(...WARNING_MODELS)
export class SearchEstimateResponseDto {
  @ApiProperty({ description: 'Tasks its agent sees' })
  readonly searchedTasks: number;

  @ApiProperty({
    description: 'Tasks it holds out, which its agent never sees',
  })
  readonly heldOutTasks: number;

  @ApiProperty({
    type: SearchRunsEstimateResponseDto,
    description: 'The most runs it may start',
  })
  readonly runs: SearchRunsEstimateResponseDto;

  @ApiProperty({
    type: SpendResponseDto,
    description: 'The most it may spend',
  })
  readonly ceiling: SpendResponseDto;

  @ApiProperty({ type: SearchAllotmentsResponseDto })
  readonly perReplayAllotments: SearchAllotmentsResponseDto;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Roughly how long it takes at its concurrency, in milliseconds, from how long the set’s runs took; unknown when none of them was timed',
  })
  readonly estimatedDuration: number | null;

  @ApiProperty({
    example: 0.05,
    description: 'The smallest gain its line counts as real',
  })
  readonly minGain: number;

  @ApiProperty({
    enum: SEARCH_OBJECTIVES,
    description: `What it would look for, as asked or as the set’s health suggests: ${OBJECTIVE_SAYS}`,
  })
  readonly objective: 'success' | 'cost';

  @ApiProperty({
    ...WARNINGS_SCHEMA,
    description:
      'What would make its results hard to trust; a search may start all the same',
  })
  readonly warnings: SearchWarningResponseDto[];

  constructor(estimate: SearchEstimateDto) {
    this.searchedTasks = estimate.searchedTasks;
    this.heldOutTasks = estimate.heldOutTasks;
    this.runs = new SearchRunsEstimateResponseDto(estimate.runs);
    this.ceiling = new SpendResponseDto(estimate.ceiling);
    this.perReplayAllotments = new SearchAllotmentsResponseDto(
      estimate.perReplayAllotments,
    );
    this.estimatedDuration = estimate.estimatedDuration;
    this.minGain = estimate.minGain;
    this.objective = estimate.objective;
    this.warnings = estimate.warnings.map(warningResponse);
  }
}

export class ProposeSearchCandidateRequestDto {
  @ApiProperty({
    example: 'terse-prompt',
    description: `A slug unique in the search: ${SEARCH_CANDIDATE_SLUG}`,
  })
  readonly name!: string;

  @ApiProperty({
    example: 'A shorter prompt keeps it on the failing test.',
    description: 'What the candidate is expected to improve, and why',
  })
  readonly hypothesis!: string;

  @ApiProperty({
    type: Object,
    description:
      'The station block, as the line stores it, changed only where a search may change it',
  })
  readonly station!: Record<string, unknown>;
}

export class SearchCandidateProposedResponseDto {
  @ApiProperty()
  readonly candidateId: string;

  @ApiProperty({ example: 'terse-prompt' })
  readonly name: string;

  @ApiProperty({
    description: 'Its replay on the search’s searched tasks, started now',
  })
  readonly replayId: string;

  constructor(proposed: {
    readonly candidateId: string;
    readonly name: string;
    readonly replayId: string;
  }) {
    this.candidateId = proposed.candidateId;
    this.name = proposed.name;
    this.replayId = proposed.replayId;
  }
}

export class RecordSearchCauseRequestDto {
  @ApiProperty({
    description:
      'A failing task the reflection’s briefing lists, by its task id',
  })
  readonly taskId!: string;

  @ApiProperty({
    enum: SEARCH_CAUSES,
    description:
      'config when a change to the station’s config could fix it; task when the task itself is why; judge when the judge scored it wrong; check when the check failed for a reason the change did not cause; infra when the run failed around the work',
  })
  readonly cause!: string;

  @ApiProperty({
    description: `What in the runs shows the cause, in 1 to ${MAX_CAUSE_TEXT} characters`,
  })
  readonly evidence!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: `What a person, or the next iteration, should change, in at most ${MAX_CAUSE_TEXT} characters`,
  })
  readonly suggestion?: string | null;
}

export class SearchCauseRecordedResponseDto {
  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({ enum: SEARCH_CAUSES })
  readonly cause: string;

  @ApiProperty({ description: 'The failing replay run the cause is about' })
  readonly replayRunId: string;

  constructor(recorded: SearchCauseRecorded) {
    this.taskId = recorded.taskId;
    this.cause = recorded.cause;
    this.replayRunId = recorded.replayRunId;
  }
}
