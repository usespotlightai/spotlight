import { Settings2, SquareMousePointer, Webhook } from 'lucide-react';

export const settingsPath = (slug: string): string => `/w/${slug}/settings`;

export const apiAccessPath = (slug: string): string =>
  `${settingsPath(slug)}/api-access`;

export const workspaceGeneralPath = (slug: string): string =>
  `${settingsPath(slug)}/general`;

export const TEAM_SETTINGS_PAGES = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'integrations', label: 'Integrations', icon: Webhook },
  { id: 'skills', label: 'Skills', icon: SquareMousePointer },
] as const;

export type TeamSettingsPageId = (typeof TEAM_SETTINGS_PAGES)[number]['id'];

export const teamSettingsPath = (
  slug: string,
  teamId: string,
  page: TeamSettingsPageId,
): string => `${settingsPath(slug)}/team/${teamId}/${page}`;
