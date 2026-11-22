/** One decision as the agent sends it; the decision checks its own rules when the handler records it. */
export interface DecisionInput {
  readonly kind: string;
  readonly title: string;
  readonly why: string;
  readonly alternatives: readonly string[];
  readonly paths: readonly string[];
}

export class RecordRunDecisionsCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly decisions: readonly DecisionInput[],
  ) {}
}
