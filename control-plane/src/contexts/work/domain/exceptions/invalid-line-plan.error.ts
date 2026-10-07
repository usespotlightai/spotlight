import type { LinePart } from '@work/domain/services/line-layout';

export class InvalidLinePlanError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    line: string,
    because: string,
    readonly part: LinePart = { of: 'line', field: null },
  ) {
    super(`Line ${line} ${because}.`);
    this.name = 'InvalidLinePlanError';
  }
}
