import type { Stranded } from '@work/domain/services/reconcile-line';

export class LineInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, stranded: readonly Stranded[]) {
    super(
      `The ${key} line would strand work at ${stranded
        .map((each) => `${each.name} (${each.tasks} standing there)`)
        .join(', ')}; move those tasks first`,
    );
    this.name = 'LineInUseError';
  }
}
