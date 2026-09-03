import { Binoculars, Play, Plug, Settings } from 'lucide-react';
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

export const TEAM_SECTIONS = [
  { id: 'runs', label: 'Runs', icon: Play },
  { id: 'observability', label: 'Observability', icon: Binoculars },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const satisfies readonly TeamSectionDefinition[];

export type TeamSection = (typeof TEAM_SECTIONS)[number];

export type TeamSectionId = TeamSection['id'];

export const FALLBACK_TEAM_SECTION_ID: TeamSectionId = 'runs';

export const teamPath = (slug: string, teamId: string): string =>
  `/w/${slug}/team/${teamId}`;

export const teamSectionPath = (
  slug: string,
  teamId: string,
  section: TeamSectionId,
): string => `${teamPath(slug, teamId)}/${section}`;

export const assemblyLinePath = (
  slug: string,
  teamId: string,
  lineId: string,
): string => `${teamPath(slug, teamId)}/lines/${lineId}`;

export const findTeamSection = (
  id: string | undefined,
): TeamSection | undefined =>
  TEAM_SECTIONS.find((section) => section.id === id);
