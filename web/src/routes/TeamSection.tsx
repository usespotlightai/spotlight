import { Navigate, useParams } from 'react-router';
import { AgentChats } from '@/components/features/agent/AgentChats';
import { InsightsPeriodPicker } from '@/components/features/insights/InsightsPeriodPicker';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import { TeamMemory } from '@/components/features/memory/TeamMemory';
import { WriteMemoryButton } from '@/components/features/memory/WriteMemoryButton';
import { TeamRuns } from '@/components/features/runs/TeamRuns';
import { TraceList } from '@/components/features/trace/list/TraceList';
import { RangePicker } from '@/components/shared/RangePicker';
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
          ) : meta.id === 'memory' ? (
            <WriteMemoryButton teamId={teamId} />
          ) : meta.id === 'insights' ? (
            <InsightsPeriodPicker />
          ) : undefined
        }
      />

      {meta.id === 'agent' && <AgentChats slug={slug} teamId={teamId} />}

      {meta.id === 'runs' && <TeamRuns slug={slug} teamId={teamId} />}

      {meta.id === 'memory' && <TeamMemory slug={slug} teamId={teamId} />}

      {meta.id === 'insights' && <TeamInsights slug={slug} teamId={teamId} />}

      {meta.id === 'observability' && (
        <TraceList slug={slug} teamId={teamId} range={range} />
      )}
    </TrailContext>
  );
}
