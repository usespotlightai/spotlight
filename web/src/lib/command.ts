import { defaultFilter } from 'cmdk';
import {
  Box,
  CircleDashed,
  Inbox,
  KeyRound,
  type LucideIcon,
  Package,
  Server,
  Settings2,
  Users,
} from 'lucide-react';
import type { LineResponseDto } from '@/lib/api';
import { inboxPath } from '@/lib/inbox';
import { membersPath } from '@/lib/members';
import { isAdmin, type Role } from '@/lib/role';
import { runnersPath } from '@/lib/runner';
import {
  apiAccessPath,
  TEAM_SETTINGS_PAGES,
  teamSettingsPath,
  workspaceGeneralPath,
} from '@/lib/settings';
import { stationPath } from '@/lib/station';
import { type Task, taskPath } from '@/lib/task';
import {
  linePath,
  TEAM_SECTIONS,
  type Team,
  type TeamSectionId,
  teamSectionPath,
} from '@/lib/team';

export type CommandTarget = {
  readonly id: string;
  readonly label: string;
  readonly context?: string;
  readonly icon: LucideIcon;
  readonly to: string;
};

export type CommandSection = {
  readonly heading: string;
  readonly targets: readonly CommandTarget[];
};

export const commandKeywords = (target: CommandTarget): string[] =>
  target.context ? [target.label, target.context] : [target.label];

export const commandMatch = (
  _value: string,
  search: string,
  keywords: readonly string[] = [],
): number => {
  const text = keywords.join(' ').toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);

  return words.every((word) => text.includes(word))
    ? defaultFilter(text, search)
    : 0;
};

export const navigationTargets = (
  slug: string,
  teams: readonly Team[],
): CommandTarget[] => [
  { id: 'inbox', label: 'Go to Inbox', icon: Inbox, to: inboxPath(slug) },
  ...teams.flatMap((team) =>
    (Object.keys(TEAM_SECTIONS) as TeamSectionId[]).map((section) => ({
      id: `team:${team.id}:${section}`,
      label: `Go to ${TEAM_SECTIONS[section].label}`,
      context: team.name,
      icon: TEAM_SECTIONS[section].icon,
      to: teamSectionPath(slug, team.id, section),
    })),
  ),
];

export const lineTargets = (
  slug: string,
  team: Team,
  lines: readonly LineResponseDto[],
): CommandTarget[] =>
  lines.map((line) => ({
    id: `line:${line.id}`,
    label: line.name,
    context: team.name,
    icon: Package,
    to: linePath(slug, team.id, line.id),
  }));

export const stationTargets = (
  slug: string,
  team: Team,
  lines: readonly LineResponseDto[],
): CommandTarget[] =>
  lines.flatMap((line) =>
    line.stations.map((station) => ({
      id: `station:${station.id}`,
      label: station.name,
      context: line.name,
      icon: Box,
      to: stationPath(slug, team.id, line.id, station.id),
    })),
  );

export const taskTargets = (
  slug: string,
  team: Team,
  tasks: readonly Task[],
): CommandTarget[] =>
  tasks.map((task) => ({
    id: `task:${task.id}`,
    label: task.title,
    context: team.name,
    icon: CircleDashed,
    to: taskPath(slug, team.id, task.id),
  }));

export const settingsTargets = (
  slug: string,
  role: Role,
  teams: readonly Team[],
): CommandTarget[] => [
  {
    id: 'settings:general',
    label: 'Go to workspace settings',
    icon: Settings2,
    to: workspaceGeneralPath(slug),
  },
  ...(isAdmin(role)
    ? [
        {
          id: 'settings:members',
          label: 'Go to members',
          icon: Users,
          to: membersPath(slug),
        },
      ]
    : []),
  {
    id: 'settings:runners',
    label: 'Go to runners',
    icon: Server,
    to: runnersPath(slug),
  },
  ...(isAdmin(role)
    ? [
        {
          id: 'settings:api-access',
          label: 'Go to API access',
          icon: KeyRound,
          to: apiAccessPath(slug),
        },
      ]
    : []),
  ...teams.flatMap((team) =>
    TEAM_SETTINGS_PAGES.map((page) => ({
      id: `settings:team:${team.id}:${page.id}`,
      label: `Go to ${page.label.toLowerCase()} settings`,
      context: team.name,
      icon: page.icon,
      to: teamSettingsPath(slug, team.id, page.id),
    })),
  ),
];

export const commandShortcut = (userAgent: string): string =>
  /Mac|iPhone|iPad/.test(userAgent) ? '⌘K' : 'Ctrl K';
