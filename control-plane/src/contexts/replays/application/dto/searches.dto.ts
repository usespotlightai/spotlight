import type { CandidatePullRequestDto } from '@replays/application/dto/config-pull-requests.dto';
import type {
  GainReadingDto,
  ModelSpentDto,
  PairTallyDto,
  RateIntervalDto,
  SpendDto,
  StationChangeDto,
} from '@replays/application/dto/replays.dto';

export interface SearchAgentDto {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface SearchBudgetDto {
  readonly iterations: number;
  readonly perIteration: number;
  readonly ceiling: SpendDto;
  readonly concurrency: number;
  readonly repeats: number;
}

export type SearchWarningDto =
  | { readonly kind: 'noise-unmeasured' }
  | {
      readonly kind: 'noisy';
      readonly spread: number;
      readonly minGain: number;
      readonly neededRepeats: number;
      readonly suggestedRepeats: number;
    }
  | { readonly kind: 'saturated'; readonly rate: number }
  | {
      readonly kind: 'judge-unstable';
      readonly agreement: number;
      readonly compared: number;
    }
  | {
      readonly kind: 'flaky-checks';
      readonly flaky: number;
      readonly rechecked: number;
    }
  | {
      readonly kind: 'sanity-failed';
      readonly gain: number;
      readonly low: number;
      readonly high: number;
      readonly worseTasks: number;
    };

export type SearchObjectiveDto = 'success' | 'cost';

export type OnlyOnSeenTasksDto = 'marked' | 'too-few-held-out';

export interface SearchBestDto {
  readonly candidateId: string;
  readonly name: string;
  readonly seed: boolean;
  readonly searchScore: number | null;
  readonly searchInterval: RateIntervalDto | null;
  readonly heldOutScore: number | null;
  readonly heldOutInterval: RateIntervalDto | null;
  readonly costPerRun: number | null;
  readonly onlyOnSeenTasks: OnlyOnSeenTasksDto | null;
}

export interface SearchSummaryDto {
  readonly id: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly setId: string;
  readonly state: string;
  readonly ending: string | null;
  readonly agent: SearchAgentDto;
  readonly budget: SearchBudgetDto;
  readonly objective: SearchObjectiveDto;
  readonly spent: SpendDto;
  readonly iterationsRun: number;
  readonly proposed: number;
  readonly best: SearchBestDto | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

export interface SearchSplitEntryDto {
  readonly runId: string;
  readonly taskId: string;
}

export interface SearchSplitDto {
  readonly searchedTasks: number;
  readonly heldOutTasks: number;
  readonly searched: readonly SearchSplitEntryDto[];
  readonly heldOut: readonly SearchSplitEntryDto[];
}

export interface ReflectedTaskDto {
  readonly taskId: string;
  readonly originalRunId: string;
  readonly replayRunId: string;
}

export interface SearchCauseDto extends ReflectedTaskDto {
  readonly cause: string;
  readonly evidence: string;
  readonly suggestion: string | null;
  readonly recordedAt: string;
}

export interface SearchReflectionDto {
  readonly standing: string | null;
  readonly tasks: readonly ReflectedTaskDto[];
  readonly causes: readonly SearchCauseDto[];
  readonly outcome: string | null;
  readonly endedSearch: boolean;
}

export interface SearchIterationDto {
  readonly number: number;
  readonly kind: string;
  readonly runId: string;
  readonly state: string;
  readonly attempts: number;
  readonly proposed: readonly string[];
  readonly agentSpent: ModelSpentDto | null;
  readonly reflection: SearchReflectionDto | null;
}

export interface SearchCandidateDto {
  readonly candidateId: string;
  readonly name: string;
  readonly seed: boolean;
  readonly iteration: number | null;
  readonly hypothesis: string | null;
  readonly fingerprint: string | null;
  readonly changes: readonly StationChangeDto[];
  readonly replayId: string;
  readonly replayState: string | null;
  readonly heldOutReplayId: string | null;
  readonly heldOutReplayState: string | null;
  readonly searchScore: number | null;
  readonly searchInterval: RateIntervalDto | null;
  readonly searchScored: number;
  readonly heldOutScore: number | null;
  readonly heldOutInterval: RateIntervalDto | null;
  readonly searchedGain: GainReadingDto | null;
  readonly heldOutGain: GainReadingDto | null;
  readonly searchedPairs: PairTallyDto | null;
  readonly heldOutPairs: PairTallyDto | null;
  readonly costPerRun: number | null;
  readonly spent: SpendDto;
  readonly onFrontier: boolean;
  readonly onlyOnSeenTasks: OnlyOnSeenTasksDto | null;
  readonly pullRequest: CandidatePullRequestDto | null;
}

export interface SearchDetailDto extends SearchSummaryDto {
  readonly split: SearchSplitDto;
  readonly iterations: readonly SearchIterationDto[];
  readonly seed: SearchCandidateDto;
  readonly candidates: readonly SearchCandidateDto[];
  readonly frontier: readonly string[];
  readonly onlyOnSeenTasks: number;
  readonly minGain: number;
}

export interface SearchRunsEstimateDto {
  readonly seed: number;
  readonly searchReplays: number;
  readonly heldOutReplays: number;
  readonly agent: number;
  readonly total: number;
}

export interface SearchAllotmentsDto {
  readonly seed: SpendDto;
  readonly searchReplay: SpendDto;
  readonly heldOutReplay: SpendDto;
  readonly agentRun: SpendDto;
}

export interface SearchEstimateDto {
  readonly searchedTasks: number;
  readonly heldOutTasks: number;
  readonly runs: SearchRunsEstimateDto;
  readonly ceiling: SpendDto;
  readonly perReplayAllotments: SearchAllotmentsDto;
  readonly estimatedDuration: number | null;
  readonly minGain: number;
  readonly objective: SearchObjectiveDto;
  readonly warnings: readonly SearchWarningDto[];
}
