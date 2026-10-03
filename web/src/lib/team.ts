import { ChartNoAxesColumn, MousePointer2, Play, Spool } from 'lucide-react';

export type Team = {
  readonly id: string;
  readonly name: string;
};

export const TEAM_SECTIONS = {
  agent: { label: 'Agent', icon: MousePointer2 },
  runs: { label: 'Runs', icon: Play },
  insights: { label: 'Insights', icon: ChartNoAxesColumn },
  memory: { label: 'Memory', icon: Spool },
} as const;

export type TeamSectionId = keyof typeof TEAM_SECTIONS;

export const FALLBACK_TEAM_SECTION_ID: TeamSectionId = 'runs';

export const teamPath = (slug: string, teamId: string): string =>
  `/w/${slug}/team/${teamId}`;

export const teamSectionPath = (
  slug: string,
  teamId: string,
  section: TeamSectionId,
): string => `${teamPath(slug, teamId)}/${section}`;

export const linePath = (
  slug: string,
  teamId: string,
  lineId: string,
): string => `${teamPath(slug, teamId)}/lines/${lineId}`;
