import type { CandidatePullRequestDto } from '@replays/application/dto/config-pull-requests.dto';
import type {
  ModelSpentDto,
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
}

export interface SearchBestDto {
  readonly candidateId: string;
  readonly name: string;
  readonly seed: boolean;
  readonly searchScore: number | null;
  readonly heldOutScore: number | null;
  readonly costPerRun: number | null;
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

export interface SearchIterationDto {
  readonly number: number;
  readonly runId: string;
  readonly state: string;
  readonly attempts: number;
  readonly proposed: readonly string[];
  readonly agentSpent: ModelSpentDto | null;
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
  readonly searchScored: number;
  readonly heldOutScore: number | null;
  readonly costPerRun: number | null;
  readonly spent: SpendDto;
  readonly onFrontier: boolean;
  readonly pullRequest: CandidatePullRequestDto | null;
}

export interface SearchDetailDto extends SearchSummaryDto {
  readonly split: SearchSplitDto;
  readonly iterations: readonly SearchIterationDto[];
  readonly seed: SearchCandidateDto;
  readonly candidates: readonly SearchCandidateDto[];
  readonly frontier: readonly string[];
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
}
