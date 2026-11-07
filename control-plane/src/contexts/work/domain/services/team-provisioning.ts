export const PROVISIONINGS = ['pending', 'done'] as const;

export type Provisioning = (typeof PROVISIONINGS)[number];

export const provisioningOf = (team: {
  readonly madeAtSignUp: boolean;
  readonly welcomed: boolean;
}): Provisioning => (team.madeAtSignUp && !team.welcomed ? 'pending' : 'done');
