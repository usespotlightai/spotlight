import { Navigate, useParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { TeamRuns } from '@/components/runs/TeamRuns';
import { RangePicker } from '@/components/trace/RangePicker';
import { TraceList } from '@/components/trace/TraceList';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useRemembered } from '@/hooks/useRemembered';
import { DEFAULT_RANGE, rangeOf } from '@/lib/range';
import {
  FALLBACK_TEAM_SECTION_ID,
  findTeamSection,
  teamSectionPath,
} from '@/lib/team';

const RANGE_KEY = 'spotlight.trace-range';

export function TeamSection() {
  const { slug, teamId, section } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const [held, remember] = useRemembered(RANGE_KEY, DEFAULT_RANGE);
  // A range that has since been dropped reads as the default, not as nothing.
  const range = rangeOf(held).id;

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
        actions={
          meta.id === 'observability' ? (
            <RangePicker value={range} onChange={remember} />
          ) : undefined
        }
      />

      {meta.id === 'runs' && <TeamRuns slug={slug} teamId={teamId} />}

      {meta.id === 'observability' && (
        <TraceList slug={slug} teamId={teamId} range={range} />
      )}
    </>
  );
}
