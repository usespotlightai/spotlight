export type SearchPolicyField =
  | 'monthlyCeiling'
  | 'currency'
  | 'ceiling'
  | 'period'
  | 'cooldown'
  | 'iterations'
  | 'repeats'
  | 'objective';

const TERRAFORM_NAMES: Readonly<Record<SearchPolicyField, string>> = {
  monthlyCeiling: 'monthly_ceiling',
  currency: 'currency',
  ceiling: 'ceiling',
  period: 'period',
  cooldown: 'cooldown',
  iterations: 'iterations',
  repeats: 'repeats',
  objective: 'objective',
};

export class InvalidSearchPolicyError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: SearchPolicyField,
    reason: string,
  ) {
    super(`Search ${TERRAFORM_NAMES[field]} ${reason}.`);
    this.name = 'InvalidSearchPolicyError';
  }
}
