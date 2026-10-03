import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { runPath, type TeamRun } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { teamCrumb } from '@/lib/team-crumb';

export function useChangeStackTrail(
  slug: string | undefined,
  teamId: string | undefined,
  run: TeamRun | undefined,
): BreadcrumbSegment[] {
  const { data: workspace } = useWorkspace(slug);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return [
    ...(team && slug ? [teamCrumb(slug, team)] : []),
    ...(run && slug && teamId
      ? [
          {
            label: run.taskTitle ?? 'Run',
            to: run.taskId ? taskPath(slug, teamId, run.taskId) : undefined,
          },
          {
            label: run.station?.name ?? 'Run',
            to: runPath(slug, teamId, run.id),
          },
        ]
      : []),
    { label: 'Change stack' },
  ];
}
