import { keepPreviousData, useQueries } from '@tanstack/react-query';

import { linesQuery } from '@/hooks/api/useLines';
import { searchedCompletedTasksQuery, tasksQuery } from '@/hooks/api/useTasks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  type CommandSection,
  completedTaskTargets,
  lineTargets,
  navigationTargets,
  settingsTargets,
  stationTargets,
  taskTargets,
} from '@/lib/commands/targets';
import type { Role } from '@/lib/role';
import type { Team } from '@/lib/team';

type CommandWorkspace = {
  readonly role: Role;
  readonly teams: readonly Team[];
};

const SEARCH_AFTER_MS = 250;
const SEARCHED_FROM = 2;

export function useCommandSections(
  slug: string,
  workspace: CommandWorkspace,
  open: boolean,
  search: string,
): CommandSection[] {
  const { teams } = workspace;
  const searched = useDebouncedValue(search.trim(), SEARCH_AFTER_MS);
  const lines = useQueries({
    queries: teams.map((team) => ({ ...linesQuery(team.id), enabled: open })),
  });
  const tasks = useQueries({
    queries: teams.map((team) => ({ ...tasksQuery(team.id), enabled: open })),
  });
  const completed = useQueries({
    queries: teams.map((team) => ({
      ...searchedCompletedTasksQuery(team.id, searched),
      enabled: open && searched.length >= SEARCHED_FROM,
      placeholderData: keepPreviousData,
    })),
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
        taskTargets(slug, team, tasks[at]?.data ?? [], lines[at]?.data ?? []),
      ),
    },
    {
      heading: 'Completed tasks',
      targets: teams.flatMap((team, at) =>
        completedTaskTargets(
          slug,
          team,
          (completed[at]?.data ?? []).filter(
            (task) => !tasks[at]?.data?.some((each) => each.id === task.id),
          ),
        ),
      ),
    },
    {
      heading: 'Settings',
      targets: settingsTargets(slug, workspace.role, teams),
    },
  ];
}
