import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryRetirementLapsedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(handles: readonly string[]) {
    super(
      `${handles.join(' and ')} ${handles.length === 1 ? 'is' : 'are'} no longer active, so retiring ${handles.length === 1 ? 'it' : 'them'} no longer applies; reject it instead.`,
    );
    this.name = 'MemoryRetirementLapsedError';
  }
}
