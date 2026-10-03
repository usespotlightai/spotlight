import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { TEAM_SECTIONS, type TeamSectionId, teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

type TeamSectionPageProps = {
  section: TeamSectionId;
  actions?: ReactNode;
  children: ReactNode;
};

export function TeamSectionPage({
  section,
  actions,
  children,
}: TeamSectionPageProps) {
  const { slug, teamId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team && slug && teamId
      ? [{ label: team.name, avatar: team.name, to: teamPath(slug, teamId) }]
      : []),
    { label: TEAM_SECTIONS[section].label },
  ];
  const { trail, forward } = useTrail(base);

  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} actions={actions} />

      {children}
    </TrailContext>
  );
}
