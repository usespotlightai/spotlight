import { Binoculars, MousePointer2, Play } from 'lucide-react';
import type { ComponentType } from 'react';

export type Team = {
  readonly id: string;
  readonly name: string;
};

type TeamSectionDefinition = {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
};

export const SECTIONS_ABOVE_LINES = [
  { id: 'agent', label: 'Agent', icon: MousePointer2 },
] as const satisfies readonly TeamSectionDefinition[];

export const SECTIONS_BELOW_LINES = [
  { id: 'runs', label: 'Runs', icon: Play },
  { id: 'observability', label: 'Observability', icon: Binoculars },
] as const satisfies readonly TeamSectionDefinition[];

const TEAM_SECTIONS = [...SECTIONS_ABOVE_LINES, ...SECTIONS_BELOW_LINES];

export type TeamSection = (typeof TEAM_SECTIONS)[number];

type TeamSectionId = TeamSection['id'];

export const FALLBACK_TEAM_SECTION_ID: TeamSectionId = 'runs';

export const teamPath = (slug: string, teamId: string): string =>
  `/w/${slug}/team/${teamId}`;

export const teamSectionPath = (
  slug: string,
  teamId: string,
  section: TeamSectionId,
): string => `${teamPath(slug, teamId)}/${section}`;

export const SETTINGS_PAGES = [
  { id: 'general', label: 'General' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'skills', label: 'Skills' },
] as const;

type SettingsPageId = (typeof SETTINGS_PAGES)[number]['id'];

export const settingsPath = (
  slug: string,
  teamId: string,
  page: SettingsPageId,
): string => `${teamPath(slug, teamId)}/settings/${page}`;

export const linePath = (
  slug: string,
  teamId: string,
  lineId: string,
): string => `${teamPath(slug, teamId)}/lines/${lineId}`;

export const findTeamSection = (
  id: string | undefined,
): TeamSection | undefined =>
  TEAM_SECTIONS.find((section) => section.id === id);
