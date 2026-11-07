import type { RunRequesterContract } from '@work/application/contracts/run-order.contract';
import type { RunSpecShape } from '@work/application/contracts/run-spec.contract';

export const HARNESS_COMMANDS = Symbol('HARNESS_COMMANDS');

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
  problemOf(choice: HarnessChoice): HarnessChoiceProblem | null;

  commandFor(
    choice: HarnessChoice,
    requester: RunRequesterContract,
    runId: string,
  ): RunSpecShape['command'] | null;
}
