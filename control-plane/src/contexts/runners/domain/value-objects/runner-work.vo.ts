import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export const RUNNER_WORK_KINDS = ['run', 'check'] as const;

export type RunnerWorkKind = (typeof RUNNER_WORK_KINDS)[number];

export class RunnerWork {
  private constructor(
    readonly kind: RunnerWorkKind,
    readonly id: string,
  ) {}

  static run(id: string): RunnerWork {
    return RunnerWork.of('run', id);
  }

  static check(id: string): RunnerWork {
    return RunnerWork.of('check', id);
  }

  static of(kind: RunnerWorkKind, id: string): RunnerWork {
    if (id.trim().length === 0) {
      throw new InvalidIdentifierError(`runner's ${kind}`);
    }

    return new RunnerWork(kind, id);
  }

  equals(other: RunnerWork): boolean {
    return this.kind === other.kind && this.id === other.id;
  }
}
