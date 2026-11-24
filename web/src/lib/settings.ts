import { Settings2, SquareMousePointer, Webhook } from 'lucide-react';

import type { CustomSettingsPageDto } from '@/lib/api';
import type { Role } from '@/lib/role';

export const settingsPath = (slug: string): string => `/w/${slug}/settings`;

export const apiAccessPath = (slug: string): string =>
  `${settingsPath(slug)}/api-access`;

export const secretsPath = (slug: string): string =>
  `${settingsPath(slug)}/secrets`;

export const workspaceGeneralPath = (slug: string): string =>
  `${settingsPath(slug)}/general`;

export const customSettingsPath = (slug: string, pageId: string): string =>
  `${settingsPath(slug)}/custom/${pageId}`;

// Whether a person with this role sees a custom settings page. It only hides the page: the service of the page checks the role itself.
export const seesCustomSettingsPage = (
  page: CustomSettingsPageDto,
  role: Role,
): boolean => page.roles.includes(role);

// The custom settings pages in one sidebar group that a person with this role sees.
export const customSettingsPagesIn = (
  pages: readonly CustomSettingsPageDto[],
  group: CustomSettingsPageDto['group'],
  role: Role,
): CustomSettingsPageDto[] =>
  pages.filter(
    (page) => page.group === group && seesCustomSettingsPage(page, role),
  );

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
