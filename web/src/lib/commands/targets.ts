import { defaultFilter } from 'cmdk';
import {
  Box,
  CircleCheck,
  CircleDashed,
  Inbox,
  KeyRound,
  LockKeyhole,
  type LucideIcon,
  Mail,
  Package,
  Server,
  Settings2,
  Users,
} from 'lucide-react';

import type { LineResponseDto } from '@/lib/api';
import { emailsPath } from '@/lib/emails';
import { inboxPath } from '@/lib/inbox';
import { membersPath } from '@/lib/members';
import { nonEmpty } from '@/lib/non-empty';
import { keysOf } from '@/lib/one-of';
import { isAdmin, type Role } from '@/lib/role';
import { runnersPath } from '@/lib/runner';
import {
  apiAccessPath,
  secretsPath,
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
  teamSectionPath,
} from '@/lib/team';

export type CommandTarget = {
  readonly id: string;
  readonly label: string;
  readonly context?: string;
  readonly keywords?: readonly string[];
  readonly icon: LucideIcon;
  readonly to: string;
};

export type PaletteSection = 'Lines' | 'Stations' | 'Tasks';

export type PalettePick = {
  readonly section: PaletteSection;
  readonly creating?: boolean;
};

export type CommandSection = {
  readonly heading: string;
  readonly targets: readonly CommandTarget[];
};

export const commandKeywords = (target: CommandTarget): string[] => [
  target.label,
  ...(nonEmpty(target.context) ? [target.context] : []),
  ...(target.keywords ?? []),
];

const descriptionOf = (task: Task): string[] =>
  nonEmpty(task.description) ? [task.description] : [];

export const commandMatch = (
  _value: string,
  search: string,
  keywords: readonly string[] = [],
): number => {
  const text = keywords.join(' ').toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 1;
  }

  return words.every((word) => text.includes(word))
    ? Math.min(...words.map((word) => defaultFilter(text, word)))
    : 0;
};

export const navigationTargets = (
  slug: string,
  teams: readonly Team[],
): CommandTarget[] => [
  { id: 'inbox', label: 'Go to Inbox', icon: Inbox, to: inboxPath(slug) },
  ...teams.flatMap((team) =>
    keysOf(TEAM_SECTIONS).map((section) => ({
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
  lines: readonly LineResponseDto[],
): CommandTarget[] => {
  const completed = new Set(
    lines.flatMap((line) =>
      line.stations
        .filter((station) => station.kind === 'completed')
        .map((station) => station.id),
    ),
  );

  return tasks
    .filter((task) => !completed.has(task.stationId))
    .map((task) => ({
      id: `task:${task.id}`,
      label: task.title,
      context: team.name,
      keywords: descriptionOf(task),
      icon: CircleDashed,
      to: taskPath(slug, team.id, task.id),
    }));
};

export const completedTaskTargets = (
  slug: string,
  team: Team,
  tasks: readonly Task[],
): CommandTarget[] =>
  tasks.map((task) => ({
    id: `task:${task.id}`,
    label: task.title,
    context: team.name,
    keywords: descriptionOf(task),
    icon: CircleCheck,
    to: taskPath(slug, team.id, task.id),
  }));

export const settingsTargets = (
  slug: string,
  role: Role,
  teams: readonly Team[],
): CommandTarget[] => [
  {
    id: 'settings:emails',
    label: 'Go to your emails',
    icon: Mail,
    to: emailsPath(slug),
  },
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
  {
    id: 'settings:secrets',
    label: 'Go to secrets',
    icon: LockKeyhole,
    to: secretsPath(slug),
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
