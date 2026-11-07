export type ProvisionAttemptOutcome =
  | 'provisioned'
  | 'failed'
  | 'full'
  | 'gone';

export type ProvisionNextStep = 'done' | 'record-failure' | 'try-another-pool';

export const ProvisionPlan = {
  after(
    outcome: ProvisionAttemptOutcome,
    onLastFittingPool: boolean,
  ): ProvisionNextStep {
    if (outcome === 'provisioned') {
      return 'done';
    }

    return outcome === 'failed' && onLastFittingPool
      ? 'record-failure'
      : 'try-another-pool';
  },
};
