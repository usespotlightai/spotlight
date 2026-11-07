export interface SearchAgentSettings {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface SearchSettings {
  readonly enabled: boolean;
  readonly monthlyCeiling: number;
  readonly currency: string;
  readonly ceiling: number;
  readonly periodMilliseconds: number;
  readonly onAlert: boolean;
  readonly cooldownMilliseconds: number;
  readonly agent: SearchAgentSettings | null;
  readonly iterations: number | null;
  readonly repeats: number | null;
  readonly objective: string | null;
}
