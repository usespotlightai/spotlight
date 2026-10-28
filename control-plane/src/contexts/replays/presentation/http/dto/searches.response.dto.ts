import {
  ApiProperty,
  ApiPropertyOptional,
  type ApiPropertyOptions,
} from '@nestjs/swagger';
import type { FailureCauseRecorded } from '@replays/application/dto/replay-outcomes.dto';
import type {
  FailureCauseDto,
  OverfitDto,
  ReflectedTaskDto,
  SearchAgentDto,
  SearchBestDto,
  SearchBudgetDto,
  SearchCandidateDto,
  SearchDetailDto,
  SearchIterationDto,
  SearchPickDto,
  SearchReflectionDto,
  SearchRegressionsDto,
  SearchSplitDto,
  SearchSplitEntryDto,
  SearchSummaryDto,
} from '@replays/application/dto/searches.dto';
import { OVERFIT_STATUSES } from '@replays/domain/services/overfit';
import {
  FAILURE_CAUSES,
  MAX_CAUSE_TEXT,
} from '@replays/domain/value-objects/failure-cause.vo';
import { REFLECTION_RESULTS } from '@replays/domain/value-objects/reflection-result';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { SEARCH_CONCURRENCY } from '@replays/domain/value-objects/search-budget.vo';
import {
  SEARCH_ITERATION_KINDS,
  SEARCH_ITERATION_STATES,
} from '@replays/domain/value-objects/search-iteration.vo';
import { SEARCH_OBJECTIVES } from '@replays/domain/value-objects/search-objective';
import { SEARCH_PICK_DECLINES } from '@replays/domain/value-objects/search-pick';
import { SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { SEARCH_STOP_REASONS } from '@replays/domain/value-objects/search-stop-reason';
import { SEARCH_TRIGGERS } from '@replays/domain/value-objects/search-trigger';
import { CandidatePullRequestResponseDto } from '@replays/presentation/http/dto/config-pull-requests.response.dto';
import { StationChangeResponseDto } from '@replays/presentation/http/dto/replay-candidate-resource.response.dto';
import {
  GainEstimateResponseDto,
  gainResponse,
  intervalResponse,
  ModelSpentResponseDto,
  MoneyResponseDto,
  PairTallyResponseDto,
  RateIntervalResponseDto,
} from '@replays/presentation/http/dto/replays.response.dto';

const OBJECTIVE_DESCRIPTION =
  'success ranks candidates by how often they succeed; cost ranks those that succeed as often as the live config, within noise, by what a run costs';

const SEARCH_CANDIDATE_SLUG =
  'lowercase letters, digits and hyphens, starting with a letter or digit, at most 63 characters';

const OVERFIT_PROPERTY: ApiPropertyOptions = {
  enum: [...OVERFIT_STATUSES, null],
  nullable: true,
  type: String,
  description:
    'marked when it beat the live config on the searched tasks but not on the held-out ones, so its gain showed only on the tasks the search could see; too-few-held-out when it beat the live config on the searched tasks but too few held-out tasks were scored on both sides to tell; null otherwise, and until its held-out replay finished',
};

const EXCEEDS_REGRESSION_LIMIT_PROPERTY: ApiPropertyOptions = {
  description:
    'Whether its regressions on the searched and held-out tasks together are more than the line’s max_regressions; false when the line has no replay_check block. It stays on the frontier, and Spotlight does not pick it',
};

export class SearchRegressionsResponseDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 1,
    description:
      'Searched tasks where it did worse than the seed: the seed succeeded and it did not, or its judge score dropped; null for the seed and until both its searched replay and the seed’s replay finished',
  })
  readonly searched: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0,
    description:
      'Held-out tasks where it did worse than the seed, counted the same way; null for the seed and until its held-out replay and the seed’s replay finished',
  })
  readonly heldOut: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 1,
    description:
      'Its searched and held-out regressions together, the count compared with the line’s max_regressions; null until either could be counted',
  })
  readonly total: number | null;

  constructor(regressions: SearchRegressionsDto) {
    this.searched = regressions.searched;
    this.heldOut = regressions.heldOut;
    this.total = regressions.total;
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

  @ApiProperty({ type: MoneyResponseDto })
  readonly ceiling: MoneyResponseDto;

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
    this.ceiling = new MoneyResponseDto(budget.ceiling);
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
  readonly isSeed: boolean;

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

  @ApiProperty(OVERFIT_PROPERTY)
  readonly overfit: OverfitDto | null;

  @ApiProperty({ type: SearchRegressionsResponseDto })
  readonly regressions: SearchRegressionsResponseDto;

  @ApiProperty(EXCEEDS_REGRESSION_LIMIT_PROPERTY)
  readonly exceedsRegressionLimit: boolean;

  constructor(best: SearchBestDto) {
    this.candidateId = best.candidateId;
    this.name = best.name;
    this.isSeed = best.isSeed;
    this.searchScore = best.searchScore;
    this.searchInterval = intervalResponse(best.searchInterval);
    this.heldOutScore = best.heldOutScore;
    this.heldOutInterval = intervalResponse(best.heldOutInterval);
    this.costPerRun = best.costPerRun;
    this.overfit = best.overfit;
    this.regressions = new SearchRegressionsResponseDto(best.regressions);
    this.exceedsRegressionLimit = best.exceedsRegressionLimit;
  }
}

export class SearchPickResponseDto {
  @ApiProperty({
    enum: ['picked', 'declined'],
    description:
      'picked when a candidate passed every gate and Spotlight opens a config pull request for it; declined when none did',
  })
  readonly outcome: 'picked' | 'declined';

  @ApiProperty({ nullable: true, type: String })
  readonly candidateId: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly name: string | null;

  @ApiProperty({
    nullable: true,
    enum: [...SEARCH_PICK_DECLINES, null],
    type: String,
    description:
      'Why no candidate was picked: none finished on the held-out tasks, none did better than the live config there by the line’s min_gain, the best was over the regression limit, the best was likely overfit, the station is gone, a config pull request for the station was open, or a config pull request for each passing candidate was closed on GitHub while the live config stayed the same',
  })
  readonly reason: string | null;

  constructor(pick: SearchPickDto) {
    this.outcome = pick.outcome;
    this.candidateId = pick.candidateId;
    this.name = pick.name;
    this.reason = pick.reason;
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
    enum: [...SEARCH_STOP_REASONS, null],
    type: String,
    description:
      'Why it stopped searching: it ran its iterations, reached its ceiling, stalled after two propose iterations in a row found nothing better (with or without a reflection, whose result says why), was stopped by a person, lost its station, or could not replay the live config',
  })
  readonly stopReason: string | null;

  @ApiProperty({ type: SearchAgentResponseDto })
  readonly agent: SearchAgentResponseDto;

  @ApiProperty({ type: SearchBudgetResponseDto })
  readonly budget: SearchBudgetResponseDto;

  @ApiProperty({
    enum: SEARCH_OBJECTIVES,
    description: `What it looks for, which orders its frontier and its best: ${OBJECTIVE_DESCRIPTION}`,
  })
  readonly objective: 'success' | 'cost';

  @ApiProperty({
    type: MoneyResponseDto,
    description:
      'What it spent so far, in its ceiling’s currency: its replays and its agent’s runs',
  })
  readonly spent: MoneyResponseDto;

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

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 2,
    description:
      'The line’s regression limit, max_regressions: the maximum number of regressions it allows a station change; null when the line has no replay_check block',
  })
  readonly maxRegressions: number | null;

  @ApiProperty({
    enum: SEARCH_TRIGGERS,
    description:
      'Why Spotlight started it: schedule when the period of the search policy ran out, alert when a station alert fired',
  })
  readonly trigger: 'schedule' | 'alert';

  @ApiProperty({
    nullable: true,
    type: SearchPickResponseDto,
    description:
      'What Spotlight did with its candidates once it finished; null until then, and for a stopped search',
  })
  readonly pick: SearchPickResponseDto | null;

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
    this.stopReason = search.stopReason;
    this.agent = new SearchAgentResponseDto(search.agent);
    this.budget = new SearchBudgetResponseDto(search.budget);
    this.objective = search.objective;
    this.spent = new MoneyResponseDto(search.spent);
    this.iterationsRun = search.iterationsRun;
    this.proposed = search.proposed;
    this.best = search.best ? new SearchBestResponseDto(search.best) : null;
    this.maxRegressions = search.maxRegressions;
    this.trigger = search.trigger;
    this.pick = search.pick && new SearchPickResponseDto(search.pick);
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

export class FailureCauseResponseDto extends ReflectedTaskResponseDto {
  @ApiProperty({
    enum: FAILURE_CAUSES,
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

  constructor(cause: FailureCauseDto) {
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
  readonly incumbent: string | null;

  @ApiProperty({
    type: ReflectedTaskResponseDto,
    isArray: true,
    description:
      'The searched tasks the best config so far still failed, which it looked into; never a held-out one',
  })
  readonly tasks: ReflectedTaskResponseDto[];

  @ApiProperty({
    type: FailureCauseResponseDto,
    isArray: true,
    description: 'One cause for each task it recorded one for',
  })
  readonly causes: FailureCauseResponseDto[];

  @ApiProperty({
    nullable: true,
    enum: [...REFLECTION_RESULTS, null],
    type: String,
    description:
      'How it ended, once it did: continued when it found a cause the config can fix and the search continued; no-config-cause when it found none; no-failures when no searched task failed, so it never ran; did-not-run when its run failed before recording a cause; ceiling-reached when it found a config cause but the search had no budget left to try it',
  })
  readonly result: string | null;

  @ApiProperty({
    description:
      'True when the search stopped searching once it ended, for whatever result other than continued',
  })
  readonly endedSearch: boolean;

  constructor(reflection: SearchReflectionDto) {
    this.incumbent = reflection.incumbent;
    this.result = reflection.result;
    this.tasks = reflection.tasks.map(
      (each) => new ReflectedTaskResponseDto(each),
    );
    this.causes = reflection.causes.map(
      (each) => new FailureCauseResponseDto(each),
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
      'How many candidates it tried to propose, those rejected included',
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
    description: 'What its agent run spent, once its usage is recorded',
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
  readonly isSeed: boolean;

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
      'How many searched replay runs, repeats included, it was scored on',
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
    type: GainEstimateResponseDto,
    description:
      'Its gain over the seed on the searched tasks, paired task by task, and whether it is within noise; null for the seed',
  })
  readonly searchedGain: GainEstimateResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: GainEstimateResponseDto,
    description:
      'Its gain over the seed on the held-out tasks, once its held-out replay finished; null for the seed',
  })
  readonly heldOutGain: GainEstimateResponseDto | null;

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

  @ApiProperty({ type: MoneyResponseDto })
  readonly spent: MoneyResponseDto;

  @ApiProperty({
    description:
      'Whether no other candidate, nor the seed, succeeds as often for less',
  })
  readonly onFrontier: boolean;

  @ApiProperty(OVERFIT_PROPERTY)
  readonly overfit: OverfitDto | null;

  @ApiProperty({ type: SearchRegressionsResponseDto })
  readonly regressions: SearchRegressionsResponseDto;

  @ApiProperty(EXCEEDS_REGRESSION_LIMIT_PROPERTY)
  readonly exceedsRegressionLimit: boolean;

  @ApiProperty({
    type: CandidatePullRequestResponseDto,
    nullable: true,
    description:
      'The pull request Spotlight opens in the line’s config repository once Spotlight picks the candidate; null for every other candidate and for the seed',
  })
  readonly pullRequest: CandidatePullRequestResponseDto | null;

  constructor(candidate: SearchCandidateDto) {
    this.candidateId = candidate.candidateId;
    this.name = candidate.name;
    this.isSeed = candidate.isSeed;
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
    this.spent = new MoneyResponseDto(candidate.spent);
    this.onFrontier = candidate.onFrontier;
    this.overfit = candidate.overfit;
    this.regressions = new SearchRegressionsResponseDto(candidate.regressions);
    this.exceedsRegressionLimit = candidate.exceedsRegressionLimit;
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
    this.minGain = search.minGain;
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

export class RecordFailureCauseRequestDto {
  @ApiProperty({
    description:
      'A failing task the reflection’s briefing lists, by its task id',
  })
  readonly taskId!: string;

  @ApiProperty({
    enum: FAILURE_CAUSES,
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

export class FailureCauseRecordedResponseDto {
  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({ enum: FAILURE_CAUSES })
  readonly cause: string;

  @ApiProperty({ description: 'The failing replay run the cause is about' })
  readonly replayRunId: string;

  constructor(recorded: FailureCauseRecorded) {
    this.taskId = recorded.taskId;
    this.cause = recorded.cause;
    this.replayRunId = recorded.replayRunId;
  }
}
