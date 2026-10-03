import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import type { InboxItem } from '@/lib/inbox';
import { taskPath } from '@/lib/task';
import { teamCrumb } from '@/lib/team-crumb';

export function useInboxItemTrail(
  slug: string | undefined,
  item: InboxItem | undefined,
): BreadcrumbSegment[] {
  const { data: workspace } = useWorkspace(slug);
  const team = workspace?.teams.find(
    (candidate) => candidate.id === item?.teamId,
  );

  return [
    ...(team && slug ? [teamCrumb(slug, team)] : []),
    ...(item && slug
      ? [{ label: item.title, to: taskPath(slug, item.teamId, item.taskId) }]
      : []),
  ];
}
