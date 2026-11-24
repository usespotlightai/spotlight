import { Settings2, SquareMousePointer, Webhook } from 'lucide-react';

import type { SettingsPageDto } from '@/lib/api';
import type { Role } from '@/lib/role';

export const settingsPath = (slug: string): string => `/w/${slug}/settings`;

export const apiAccessPath = (slug: string): string =>
  `${settingsPath(slug)}/api-access`;

export const secretsPath = (slug: string): string =>
  `${settingsPath(slug)}/secrets`;

export const workspaceGeneralPath = (slug: string): string =>
  `${settingsPath(slug)}/general`;

export const extraSettingsPath = (slug: string, pageId: string): string =>
  `${settingsPath(slug)}/x/${pageId}`;

// The pages of the deployment in one sidebar group that a person with this role sees.
export const extraSettingsPagesIn = (
  pages: readonly SettingsPageDto[],
  group: SettingsPageDto['group'],
  role: Role,
): SettingsPageDto[] =>
  pages.filter((page) => page.group === group && page.roles.includes(role));

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
