import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import type { LineResponseDto } from '@/lib/api';
import { linePath, teamPath } from '@/lib/team';

type TaskTrailParams = {
  readonly slug?: string;
  readonly teamId?: string;
  readonly line?: LineResponseDto;
  readonly title?: string;
};

export function useTaskTrail({
  slug,
  teamId,
  line,
  title,
}: TaskTrailParams): BreadcrumbSegment[] {
  const { data: workspace } = useWorkspace(slug);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);
  const known = slug && teamId ? { slug, teamId } : null;

  return [
    ...(team
      ? [
          {
            label: team.name,
            avatar: team.name,
            to: known ? teamPath(known.slug, known.teamId) : undefined,
          },
        ]
      : []),
    ...(line
      ? [
          {
            label: line.name,
            to: known ? linePath(known.slug, known.teamId, line.id) : undefined,
          },
        ]
      : []),
    { label: title ?? '' },
  ];
}
