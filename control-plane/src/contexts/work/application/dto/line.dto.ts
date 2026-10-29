import type {
  LineReplayCheckSummary,
  LineSearchSummary,
  LineSourceSummary,
  RepositorySummary,
  SearchPolicySummary,
  StationAlertSummary,
  StationJudgeSummary,
} from '@work/application/ports/line-reader.port';
import type { StationKind } from '@work/domain/entities/station.entity';

export interface StationDto {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly position: number;
  readonly color: string;
  readonly description: string | null;
  readonly harness: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly agentPrompt: string | null;
  readonly judge: StationJudgeSummary | null;
  readonly alerts: readonly StationAlertSummary[];
  readonly search: SearchPolicySummary | null;
  readonly kind: StationKind;
  readonly skills: readonly string[];
}

interface ReactionDto {
  readonly happening: string;
  readonly from: string | null;
  readonly to: string;
}

export interface LineDto {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly stations: readonly StationDto[];
  readonly reactions: readonly ReactionDto[];
  readonly repositories: readonly RepositorySummary[];
  readonly source: LineSourceSummary | null;
  readonly replayCheck: LineReplayCheckSummary | null;
  readonly search: LineSearchSummary;
}
