import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { MOST_CHECK_COMMAND } from '@change-review/domain/value-objects/stack-check.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

const oneLine = (raw: string, what: string): string => {
  const trimmed = raw.trim();

  if (
    !trimmed ||
    trimmed.length > MOST_CHECK_COMMAND ||
    /[\r\n]/.test(trimmed)
  ) {
    throw InvalidChangeStackError.because(
      `${what} must be one line of at most ${MOST_CHECK_COMMAND} characters`,
    );
  }

  return trimmed;
};

export interface CheckingPlan {
  readonly command: string;
  readonly setups: ReadonlyMap<string, string>;
  readonly placement: RunnerPlacement;
}

export class CheckRequest {
  private constructor(
    readonly command: string,
    readonly setup: string | null,
    readonly placement: RunnerPlacement,
  ) {}

  static of(
    command: string,
    setup: string | null,
    placement: RunnerPlacement = RunnerPlacement.anywhere(),
  ): CheckRequest {
    return new CheckRequest(
      oneLine(command, 'check command'),
      setup === null ? null : oneLine(setup, 'setup command'),
      placement,
    );
  }

  static forRepository(
    plan: CheckingPlan | null,
    repository: string | null,
  ): CheckRequest | null {
    if (!plan?.command.trim()) {
      return null;
    }

    return CheckRequest.of(
      plan.command,
      plan.setups.get(repository ?? '') ?? null,
      plan.placement,
    );
  }

  equals(other: CheckRequest): boolean {
    return (
      this.command === other.command &&
      this.setup === other.setup &&
      this.placement.equals(other.placement)
    );
  }
}
