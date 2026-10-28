export type SearchPolicyField =
  | 'monthlyCeiling'
  | 'currency'
  | 'ceiling'
  | 'period'
  | 'cooldown'
  | 'iterations'
  | 'repeats'
  | 'objective';

export class InvalidSearchPolicyError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: SearchPolicyField,
    reason: string,
  ) {
    super(`Search ${field} ${reason}.`);
    this.name = 'InvalidSearchPolicyError';
  }
}
