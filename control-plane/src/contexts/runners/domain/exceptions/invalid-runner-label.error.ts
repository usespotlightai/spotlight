import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { slugAdvice } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class InvalidRunnerLabelError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly because: string,
    message = `Runner label ${because}.`,
  ) {
    super(message);
    this.name = 'InvalidRunnerLabelError';
  }

  static notSlug(example: string): InvalidRunnerLabelError {
    const advice = `${slugAdvice(example)}.`;

    return new InvalidRunnerLabelError(
      advice,
      `Runner label is not valid. ${advice}`,
    );
  }
}
