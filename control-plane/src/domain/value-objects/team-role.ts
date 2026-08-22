export const TEAM_ROLES = ['owner', 'member'] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];
