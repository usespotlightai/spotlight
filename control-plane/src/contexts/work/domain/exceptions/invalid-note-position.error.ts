import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidNotePositionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(value: number | string) {
    super(`Task trail has no position ${value}.`);
    this.name = 'InvalidNotePositionError';
  }
}
