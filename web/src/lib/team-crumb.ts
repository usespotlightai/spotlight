import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { teamPath } from '@/lib/team';

export const teamCrumb = (
  slug: string,
  team: { readonly id: string; readonly name: string },
): BreadcrumbSegment => ({
  label: team.name,
  avatar: team.name,
  to: teamPath(slug, team.id),
});
