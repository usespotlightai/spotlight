import { Navigate, useParams } from 'react-router';
import { TeamRuns } from '@/components/features/runs/TeamRuns';
import { RangePicker } from '@/components/features/trace/list/RangePicker';
import { TraceList } from '@/components/features/trace/list/TraceList';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useRemembered } from '@/hooks/useRemembered';
import { DEFAULT_RANGE, rangeOf } from '@/lib/range';
import {
  FALLBACK_TEAM_SECTION_ID,
  findTeamSection,
  teamPath,
  teamSectionPath,
} from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

const RANGE_KEY = 'spotlight.trace-range';

export function TeamSection() {
  const { slug, teamId, section } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const [held, remember] = useRemembered(RANGE_KEY, DEFAULT_RANGE);
  // A range that has since been dropped reads as the default, not as nothing.
  const range = rangeOf(held).id;

  const meta = findTeamSection(section);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team && slug && teamId
      ? [{ label: team.name, avatar: team.name, to: teamPath(slug, teamId) }]
      : []),
    ...(meta ? [{ label: meta.label }] : []),
  ];
  const { trail, forward } = useTrail(base);

  if (!slug || !teamId) {
    return null;
  }

  if (!meta) {
    return (
      <Navigate
        to={teamSectionPath(slug, teamId, FALLBACK_TEAM_SECTION_ID)}
        replace
      />
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
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
    </TrailContext>
  );
}
