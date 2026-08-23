import { Navigate, useParams } from 'react-router';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import {
  FALLBACK_TEAM_SECTION_ID,
  findTeamSection,
  teamSectionPath,
} from '@/lib/team';

export function TeamSection() {
  const { slug, teamId, section } = useParams();
  const { data: workspace } = useWorkspace(slug);

  if (!slug || !teamId) {
    return null;
  }

  const meta = findTeamSection(section);

  if (!meta) {
    return (
      <Navigate
        to={teamSectionPath(slug, teamId, FALLBACK_TEAM_SECTION_ID)}
        replace
      />
    );
  }

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return (
    <PageHeader
      title={
        <Breadcrumbs segments={team ? [team.name, meta.label] : [meta.label]} />
      }
    />
  );
}
