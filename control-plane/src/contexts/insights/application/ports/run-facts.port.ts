export const RUN_FACTS = Symbol('INSIGHTS_RUN_FACTS');

export interface RunFactsDrift {
  readonly checked: number;
  readonly repaired: readonly string[];
}

export interface RunFactsPort {
  repairEndedSince(since: Date): Promise<RunFactsDrift>;
}
