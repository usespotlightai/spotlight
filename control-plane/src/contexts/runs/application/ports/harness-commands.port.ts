import type { RunCommandShape } from '@runs/application/contracts/run-spec.contract';

export const HARNESS_COMMANDS = Symbol('HARNESS_COMMANDS');

/** A harness with the model and effort a station or agent picked for it, as stored: not yet checked. */
export interface HarnessChoice {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface HarnessChoiceProblem {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

export interface HarnessCommandsPort {
  /** Why no runner can start the harness as chosen, or null when one can. */
  problemOf(choice: HarnessChoice): HarnessChoiceProblem | null;

  /**
   * The command that starts the chosen harness, with the trace parent of `trail` (such as `session:<id>`) and the
   * run, or null when no runner can start it as chosen.
   */
  commandFor(
    choice: HarnessChoice,
    trail: string,
    runId: string,
  ): RunCommandShape | null;
}
