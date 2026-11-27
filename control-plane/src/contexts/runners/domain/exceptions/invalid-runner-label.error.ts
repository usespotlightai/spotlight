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

  // A label that is not a slug. Its reason is advice, so that it reads on its own under the field it is about.
  static notSlug(example: string): InvalidRunnerLabelError {
    const advice = `${slugAdvice(example)}.`;

    return new InvalidRunnerLabelError(
      advice,
      `Runner label is not valid. ${advice}`,
    );
  }
}
