import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class StaleTaskRevisionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string, expected: number, current: number) {
    super(
      `Task ${id} moved since revision ${expected}. Please reload and try again. Current revision: ${current}`,
    );
    this.name = 'StaleTaskRevisionError';
  }
}
