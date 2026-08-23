import { Activity, Gauge, Settings, Workflow } from 'lucide-react';
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

/** The sections every team has. Adding one here adds its route and nav entry. */
export const TEAM_SECTIONS = [
  { id: 'lines', label: 'Assembly lines', icon: Workflow },
  { id: 'runs', label: 'Runs', icon: Activity },
  { id: 'monitoring', label: 'Monitoring', icon: Gauge },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const satisfies readonly TeamSectionDefinition[];

export type TeamSection = (typeof TEAM_SECTIONS)[number];

/** The section ids as a union, so a mistyped path fails to compile. */
export type TeamSectionId = TeamSection['id'];

export const DEFAULT_TEAM_SECTION_ID: TeamSectionId = 'lines';

export const teamSectionPath = (
  slug: string,
  teamId: string,
  section: TeamSectionId,
): string => `/w/${slug}/team/${teamId}/${section}`;

export const teamPath = (slug: string, teamId: string): string =>
  teamSectionPath(slug, teamId, DEFAULT_TEAM_SECTION_ID);

export const findTeamSection = (
  id: string | undefined,
): TeamSection | undefined =>
  TEAM_SECTIONS.find((section) => section.id === id);
