import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export class GenerationError extends Error {
  readonly truncated: boolean;

  constructor(
    reason: string,
    readonly usage: ModelCall | null,
    options: { readonly truncated?: boolean } = {},
  ) {
    super(reason);
    this.truncated = options.truncated ?? false;
    this.name = 'GenerationError';
  }
}
