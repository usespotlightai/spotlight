import type { StrandedStation } from '@lines/domain/value-objects/stranded-station';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class LineInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    key: string,
    readonly stranded: readonly StrandedStation[],
  ) {
    super(
      `Line ${key} would strand tasks. Please move those tasks first. Stations with tasks: ${stranded
        .map((each) => `${each.name} (${each.tasks})`)
        .join(', ')}`,
    );
    this.name = 'LineInUseError';
  }
}
