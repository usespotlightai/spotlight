export const settingsPath = (slug: string): string => `/w/${slug}/settings`;

export const workspaceGeneralPath = (slug: string): string =>
  `${settingsPath(slug)}/general`;

export const TEAM_SETTINGS_PAGES = [
  { id: 'general', label: 'General' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'skills', label: 'Skills' },
] as const;

export type TeamSettingsPageId = (typeof TEAM_SETTINGS_PAGES)[number]['id'];

export const teamSettingsPath = (
  slug: string,
  teamId: string,
  page: TeamSettingsPageId,
): string => `${settingsPath(slug)}/team/${teamId}/${page}`;
