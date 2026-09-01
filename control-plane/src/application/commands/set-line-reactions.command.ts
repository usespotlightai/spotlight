export interface ReactionChange {
  readonly happening: string;
  /** Where the task must stand for it to count. Null is wherever it is. */
  readonly from: string | null;
  readonly to: string;
}

export class SetLineReactionsCommand {
  constructor(
    readonly lineId: string,
    readonly reactions: readonly ReactionChange[],
  ) {}
}
