import { SEARCH_OBJECTIVES as STATION_SEARCH_OBJECTIVES } from '@lines/domain/value-objects/search-policy.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';

export type AlertMeasureView =
  | 'sent_back_rate'
  | 'accepted_rate'
  | 'checks_failed_rate'
  | 'failed_rate'
  | 'merged_rate'
  | 'cost_per_run';

export type SearchObjectiveView = 'success' | 'cost';

export const SEARCH_OBJECTIVES: readonly SearchObjectiveView[] =
  STATION_SEARCH_OBJECTIVES;

export const PLAIN_STATION_COLOR: string = StationColor.plain().value;

export type StationKindView = 'backlog' | 'work' | 'completed';

export interface StationJudgeView {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly rubricVersion: string;
  readonly sample: number;
  readonly minAgreement: number;
}

interface SearchAgentView {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface SearchPolicyView {
  readonly enabled: boolean;
  readonly monthlyCeiling: number;
  readonly currency: string;
  readonly ceiling: number;
  readonly period: string;
  readonly periodMilliseconds: number;
  readonly onAlert: boolean;
  readonly cooldown: string;
  readonly cooldownMilliseconds: number;
  readonly agent: SearchAgentView | null;
  readonly iterations: number | null;
  readonly repeats: number | null;
  readonly objective: SearchObjectiveView | null;
}

export interface StationAlertView {
  readonly measure: AlertMeasureView;
  readonly risesBy: number | null;
  readonly above: number | null;
  readonly fallsBy: number | null;
  readonly below: number | null;
  readonly over: number;
}

export interface StationView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly kind: StationKindView;
  readonly position: number;
  readonly color: string;
  readonly description: string | null;
  readonly passesTo: readonly string[];
  readonly ends: boolean;
  readonly harness: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profile: string | null;
  readonly agentPrompt: string | null;
  readonly check: string | null;
  readonly runners: readonly string[];
  readonly diffs: boolean;
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly judge: StationJudgeView | null;
  readonly alerts: readonly StationAlertView[];
  readonly search: SearchPolicyView | null;
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

interface LineRepositoryView {
  readonly repository: string;
  readonly setup: string | null;
}

interface ReviewPolicyView {
  readonly start: 'opened' | 'mentioned';
  readonly mention: string;
  readonly label: string;
  readonly skip: {
    readonly spotlight: boolean;
    readonly drafts: boolean;
    readonly authors: readonly string[];
  };
}

interface ReplayCheckView {
  readonly maxRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
}

interface ReactionView {
  readonly happening: string;
  readonly from: string | null;
  readonly to: string;
}

export interface LineView {
  readonly id: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly key: string;
  readonly name: string;
  readonly role: string | null;
  readonly runners: readonly string[];
  readonly image: string | null;
  readonly repositories: readonly LineRepositoryView[];
  readonly reviews: ReviewPolicyView | null;
  readonly replayCheck: ReplayCheckView | null;
  readonly source: {
    readonly repository: string;
    readonly path: string;
  } | null;
  readonly reactions: readonly ReactionView[];
  readonly stations: readonly StationView[];
}
