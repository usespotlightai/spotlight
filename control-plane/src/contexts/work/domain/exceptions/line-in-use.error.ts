import type { Stranded } from '@work/domain/services/reconcile-line';

export class LineInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string, stranded: readonly Stranded[]) {
    super(
      `Line ${key} would strand tasks. Please move those tasks first. Stations with tasks: ${stranded
        .map((each) => `${each.name} (${each.tasks})`)
        .join(', ')}`,
    );
    this.name = 'LineInUseError';
  }
}
