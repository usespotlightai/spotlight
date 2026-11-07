export const TEAM_ORIGINS = ['sign-up', 'configuration'] as const;

export type TeamOrigin = (typeof TEAM_ORIGINS)[number];
