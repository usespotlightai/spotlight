import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export type JudgingTrouble = 'refused' | 'unreadable';

export class JudgingError extends Error {
  constructor(
    readonly trouble: JudgingTrouble,
    reason: string,
    readonly usage: ModelCall | null,
  ) {
    super(`The run could not be judged: ${reason}`);
    this.name = 'JudgingError';
  }
}
