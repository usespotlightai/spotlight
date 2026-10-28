import type { RepositoryHost } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StationKind } from '@work/domain/entities/station.entity';

export interface StationJudgeSummary {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly sample: number;
  readonly minAgreement: number;
}

export interface StationAlertSummary {
  readonly measure: string;
  readonly risesBy: number | null;
  readonly above: number | null;
  readonly fallsBy: number | null;
  readonly below: number | null;
  readonly over: number;
}

export interface StationSummary {
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
  readonly kind: StationKind;
  readonly skills: readonly string[];
}

interface ReactionSummary {
  readonly happening: string;
  readonly from: string | null;
  readonly to: string;
}

export interface LineSourceSummary {
  readonly repository: string;
  readonly path: string;
}

export interface LineReplayCheckSummary {
  readonly maxRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
}

export interface RepositorySummary {
  readonly fullName: string;
  readonly host: RepositoryHost;
  readonly url: string;
}

export interface LineDetail {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly stations: readonly StationSummary[];
  readonly reactions: readonly ReactionSummary[];
  readonly repositories: readonly RepositorySummary[];
  readonly source: LineSourceSummary | null;
  readonly replayCheck: LineReplayCheckSummary | null;
}

export const LINE_READER = Symbol('LINE_READER');

export interface LineReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<LineDetail[] | null>;
}
