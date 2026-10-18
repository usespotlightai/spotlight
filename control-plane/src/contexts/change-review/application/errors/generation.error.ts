import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export class GenerationError extends Error {
  constructor(
    reason: string,
    readonly usage: ModelCall | null,
  ) {
    super(reason);
    this.name = 'GenerationError';
  }
}
