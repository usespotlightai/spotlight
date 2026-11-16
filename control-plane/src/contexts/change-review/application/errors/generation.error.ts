import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export class GenerationError extends Error {
  readonly truncated: boolean;
  readonly insufficientCredits: boolean;

  constructor(
    reason: string,
    readonly usage: ModelCall | null,
    options: {
      readonly truncated?: boolean;
      readonly insufficientCredits?: boolean;
    } = {},
  ) {
    super(reason);
    this.truncated = options.truncated ?? false;
    this.insufficientCredits = options.insufficientCredits ?? false;
    this.name = 'GenerationError';
  }
}
