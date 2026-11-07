const PROVISIONINGS = ['pending', 'done'] as const;

export type Provisioning = (typeof PROVISIONINGS)[number];

export type TeamOrigin = 'sign-up' | 'configuration';

export const welcomes = (origin: TeamOrigin): boolean => origin === 'sign-up';

export const provisioningOf = (team: {
  readonly origin: TeamOrigin;
  readonly welcomed: boolean;
}): Provisioning =>
  welcomes(team.origin) && !team.welcomed ? 'pending' : 'done';
