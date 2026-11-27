/** What a command that a step of a run ran puts to the team: a new memory, the retirement of one, or neither. */
export type StepCommandProposal = 'memory' | 'retirement' | null;

/** A command that a step of a run ran, in memory's terms. */
export interface StepCommand {
  readonly proposes: StepCommandProposal;
  /**
   * What the command carried: the body of the memory or the reason to retire one, as the agent gave it. Null where
   * it carried none, or gave it in a way the step does not show, such as from stdin.
   */
  readonly carrying: string | null;
  /** The command alone, as a person reads it. */
  readonly text: string;
}

/** A step of a run that a memory can cite as where it came from. */
export interface RunStep {
  readonly index: number;
  readonly kind: string;
  /** The step as a person reads it: for a step that ran several commands, its first. */
  readonly text: string;
  /** Each command the step ran, in order. */
  readonly commands: readonly StepCommand[];
}
