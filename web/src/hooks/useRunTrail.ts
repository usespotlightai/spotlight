import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import type { TeamRun } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { teamCrumb } from '@/lib/team-crumb';

type RunTrailParams = {
  readonly slug: string;
  readonly teamId: string;
  readonly run: TeamRun;
  readonly title?: string;
};

export function useRunTrail({
  slug,
  teamId,
  run,
  title,
}: RunTrailParams): BreadcrumbSegment[] {
  const { data: workspace } = useWorkspace(slug);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return [
    ...(team ? [teamCrumb(slug, team)] : []),
    {
      label: title ?? run.taskTitle ?? 'Run',
      to: run.taskId ? taskPath(slug, teamId, run.taskId) : undefined,
    },
    { label: run.station?.name ?? 'Run' },
  ];
}
