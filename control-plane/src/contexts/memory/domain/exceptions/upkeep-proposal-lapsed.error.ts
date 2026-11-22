import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UpkeepProposalLapsedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(handles: readonly string[]) {
    super(
      `${handles.join(' and ')} ${handles.length === 1 ? 'was' : 'were'} retired after the sweep, so this change no longer applies; keep it instead.`,
    );
    this.name = 'UpkeepProposalLapsedError';
  }
}
