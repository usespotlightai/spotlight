import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EgressInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    key: string,
    readonly pools: readonly string[],
  ) {
    super(
      `Egress ${key} is in use. Runner pools that name it: ${pools.join(', ')}. Please remove provision.egress from these pools first.`,
    );
    this.name = 'EgressInUseError';
  }
}
