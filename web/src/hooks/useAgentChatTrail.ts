import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { nonEmpty } from '@/lib/non-empty';
import { teamSectionPath } from '@/lib/team';
import { teamCrumb } from '@/lib/team-crumb';

export function useAgentChatTrail(
  slug: string | undefined,
  teamId: string | undefined,
  title: string | undefined,
): BreadcrumbSegment[] {
  const { data: workspace } = useWorkspace(slug);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return [
    ...(team && nonEmpty(slug) ? [teamCrumb(slug, team)] : []),
    ...(nonEmpty(slug) && nonEmpty(teamId)
      ? [{ label: 'Agent', to: teamSectionPath(slug, teamId, 'agent') }]
      : []),
    { label: title ?? 'Chat' },
  ];
}
