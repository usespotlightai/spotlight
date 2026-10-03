import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useWorkspace } from '@/hooks/api/useWorkspace';
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
    ...(team && slug ? [teamCrumb(slug, team)] : []),
    ...(slug && teamId
      ? [{ label: 'Agent', to: teamSectionPath(slug, teamId, 'agent') }]
      : []),
    { label: title ?? 'Chat' },
  ];
}
