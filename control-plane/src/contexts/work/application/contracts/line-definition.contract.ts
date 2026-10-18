type LineDefinitionStationKind = 'backlog' | 'work' | 'completed';

export type LineDefinitionJudge = {
  readonly rubric?: string;
  readonly claims?: readonly string[];
  readonly passThreshold?: number;
  readonly sample: number;
  readonly minAgreement: number;
};

export type LineDefinitionAlert = {
  readonly measure: string;
  readonly risesBy?: number;
  readonly above?: number;
  readonly fallsBy?: number;
  readonly below?: number;
  readonly over: number;
};

export type LineDefinitionStation = {
  readonly key: string;
  readonly name: string;
  readonly kind: LineDefinitionStationKind;
  readonly color?: string;
  readonly description?: string;
  readonly harness?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly profile?: string;
  readonly prompt?: string;
  readonly check?: string;
  readonly runners?: readonly string[];
  readonly diffs?: boolean;
  readonly decisions?: boolean;
  readonly memories?: boolean;
  readonly judge?: LineDefinitionJudge;
  readonly alerts: readonly LineDefinitionAlert[];
  readonly tools: readonly string[];
  readonly skills: readonly string[];
  readonly passesTo: readonly string[];
  readonly ends: boolean;
};

export type LineDefinitionRepository = {
  readonly name: string;
  readonly image?: string;
  readonly setup?: string;
};

export type LineDefinitionReaction = {
  readonly happening: string;
  readonly from?: string;
  readonly to: string;
};

type LineDefinitionReviewSkips = {
  readonly spotlight?: boolean;
  readonly drafts?: boolean;
  readonly authors?: readonly string[];
};

export type LineDefinitionReviews = {
  readonly start?: 'opened' | 'mentioned';
  readonly mention?: string;
  readonly label?: string;
  readonly skip: LineDefinitionReviewSkips;
};

export type LineDefinitionReplayCheck = {
  readonly maxRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
};

export type LineDefinitionSource = {
  readonly repository: string;
  readonly path: string;
};

export type LineDefinition = {
  readonly key: string;
  readonly name: string;
  readonly role?: string;
  readonly repositories: readonly LineDefinitionRepository[];
  readonly runners?: readonly string[];
  readonly stations: readonly LineDefinitionStation[];
  readonly reactions: readonly LineDefinitionReaction[];
  readonly reviews?: LineDefinitionReviews;
  readonly replayCheck?: LineDefinitionReplayCheck;
  readonly source?: LineDefinitionSource;
};
