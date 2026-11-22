import { StackProblem } from '@change-review/domain/value-objects/stack-problem.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidChangeStackError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly problems: readonly StackProblem[]) {
    super(`A change stack ${problems.map((each) => each.message).join('; ')}.`);
    this.name = 'InvalidChangeStackError';
  }

  static because(...messages: string[]): InvalidChangeStackError {
    return new InvalidChangeStackError(messages.map(StackProblem.shape));
  }
}
