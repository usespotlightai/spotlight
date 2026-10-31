import { useQueries } from '@tanstack/react-query';
import { linesQuery } from '@/hooks/api/useLines';
import { tasksQuery } from '@/hooks/api/useTasks';
import {
  type CommandSection,
  lineTargets,
  navigationTargets,
  settingsTargets,
  stationTargets,
  taskTargets,
} from '@/lib/command';
import type { Role } from '@/lib/role';
import type { Team } from '@/lib/team';

type CommandWorkspace = {
  readonly role: Role;
  readonly teams: readonly Team[];
};

export function useCommandSections(
  slug: string,
  workspace: CommandWorkspace,
  open: boolean,
): CommandSection[] {
  const { teams } = workspace;
  const lines = useQueries({
    queries: teams.map((team) => ({ ...linesQuery(team.id), enabled: open })),
  });
  const tasks = useQueries({
    queries: teams.map((team) => ({ ...tasksQuery(team.id), enabled: open })),
  });

  return [
    { heading: 'Navigation', targets: navigationTargets(slug, teams) },
    {
      heading: 'Lines',
      targets: teams.flatMap((team, at) =>
        lineTargets(slug, team, lines[at]?.data ?? []),
      ),
    },
    {
      heading: 'Stations',
      targets: teams.flatMap((team, at) =>
        stationTargets(slug, team, lines[at]?.data ?? []),
      ),
    },
    {
      heading: 'Tasks',
      targets: teams.flatMap((team, at) =>
        taskTargets(slug, team, tasks[at]?.data ?? []),
      ),
    },
    {
      heading: 'Settings',
      targets: settingsTargets(slug, workspace.role, teams),
    },
  ];
}
