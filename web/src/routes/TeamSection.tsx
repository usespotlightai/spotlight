import { Navigate, useParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { TeamRuns } from '@/components/runs/TeamRuns';
import { TraceList } from '@/components/trace/TraceList';
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
    <>
      <PageHeader
        title={
          <Breadcrumbs
            segments={[
              ...(team
                ? [
                    {
                      label: team.name,
                      icon: (
                        <InitialAvatar name={team.name} className="bg-card" />
                      ),
                    },
                  ]
                : []),
              { label: meta.label },
            ]}
          />
        }
      />

      {meta.id === 'runs' && <TeamRuns slug={slug} teamId={teamId} />}

      {meta.id === 'observability' && <TraceList slug={slug} teamId={teamId} />}
    </>
  );
}
