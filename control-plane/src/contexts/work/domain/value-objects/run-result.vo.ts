import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';

export class RunResult {
  private constructor(
    readonly exitCode: number,
    readonly failure: { readonly code: RunFailureCode } | null,
    readonly message: string | null,
    readonly stopped: boolean,
  ) {}

  static of(input: {
    exitCode: number;
    failure: RunFailureCode | null;
    message: string | null;
    stopped: boolean;
  }): RunResult {
    return new RunResult(
      input.exitCode,
      input.failure === null ? null : { code: input.failure },
      input.message,
      input.stopped,
    );
  }

  get failed(): boolean {
    return this.failure !== null;
  }

  // Spotlight refused to start the run: nothing ran.
  get refused(): boolean {
    return this.failure?.code === 'refused';
  }

  get handsOver(): boolean {
    return !this.failed && !this.stopped;
  }
}
