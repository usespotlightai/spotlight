import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { SkillTrendMark } from '@/components/features/insights/tools/SkillTrendMark';
import { SkillWeeksChart } from '@/components/features/insights/tools/SkillWeeksChart';
import { CollapsibleRows } from '@/components/shared/nested-table/CollapsibleRows';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { Collapsibles } from '@/hooks/useCollapsibles';
import {
  formatCount,
  formatStation,
  insightsPath,
  type StationNames,
  viewOf,
} from '@/lib/insights';
import {
  givenOf,
  NOT_GIVEN_NOTE,
  type SkillReport,
  skillEnabledFilter,
  skillUsedFilter,
  weeksWidth,
} from '@/lib/insights-tools';
import { skillPath } from '@/lib/skills';
import { cn } from '@/lib/utils';

const SHARE_CELL =
  "flex min-w-0 flex-col items-start pl-(--cell-indent,0.5rem) before:text-muted-foreground before:text-xs before:content-['Share_read'] @4xl:col-span-1 @4xl:block @4xl:pl-0 @4xl:before:hidden";

const SHARE_LINE = 'flex min-w-0 items-center gap-3';

const SHARE_FIGURE = 'shrink-0 @4xl:w-12 @4xl:text-right';

function Given({
  counts,
  children,
}: {
  counts: { enabled: number; used: number };
  children: ReactNode;
}) {
  return givenOf(counts) === 'Not given' ? (
    <WithTooltip tooltip={NOT_GIVEN_NOTE}>
      <span className="text-muted-foreground">Not given</span>
    </WithTooltip>
  ) : (
    children
  );
}

type SkillRowsProps = {
  slug: string;
  teamId: string;
  skill: SkillReport;
  teamRuns: number;
  max: number;
  names: StationNames;
  collapsibles: Collapsibles;
};

export function SkillRows({
  slug,
  teamId,
  skill,
  teamRuns,
  max,
  names,
  collapsibles,
}: SkillRowsProps) {
  const open = collapsibles.isOpen(skill.key);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { period } = viewOf(params);

  const width = weeksWidth(skill.weeks.length);

  return (
    <>
      <NestedGroupRow
        label={skill.key}
        open={open}
        depth={0}
        onToggle={
          skill.stations.length > 0
            ? () => collapsibles.toggle(skill.key)
            : undefined
        }
        cells={
          <div className="contents [--cell-indent:1.375rem]">
            <NestedCell heading="Runs">{formatCount(teamRuns)}</NestedCell>
            <NestedCell heading="Runs given">
              <Given counts={skill}>
                <InsightsLink
                  tab="traces"
                  filter={skillEnabledFilter(skill.key)}
                >
                  {formatCount(skill.enabled)}
                </InsightsLink>
              </Given>
            </NestedCell>
            <NestedCell heading="Runs read" strong>
              <InsightsLink tab="traces" filter={skillUsedFilter(skill.key)}>
                {formatCount(skill.used)}
              </InsightsLink>
            </NestedCell>
            <span className={cn('col-span-full', SHARE_CELL)}>
              <span className={SHARE_LINE}>
                <SkillWeeksChart
                  weeks={skill.weeks}
                  max={max}
                  onWeek={(week) =>
                    void navigate(
                      insightsPath(slug, teamId, {
                        tab: 'traces',
                        period,
                        filter: skillUsedFilter(skill.key, { week }),
                        page: 1,
                      }),
                    )
                  }
                />
                <span className={SHARE_FIGURE}>
                  <SkillTrendMark
                    rate={skill.usedRate}
                    used={skill.used}
                    runs={teamRuns}
                    trend={skill.trend}
                  />
                </span>
              </span>
            </span>
          </div>
        }
      >
        {skill.defined ? (
          <TrailLink
            to={skillPath(slug, teamId, skill.key)}
            className="truncate text-foreground hover:underline"
          >
            {skill.key}
          </TrailLink>
        ) : (
          <span className="truncate text-foreground">{skill.key}</span>
        )}
      </NestedGroupRow>

      {skill.stations.length > 0 && (
        <CollapsibleRows open={open} label={`Stations using ${skill.key}`}>
          {skill.stations.map((station) => (
            <li
              key={station.stationId}
              data-slot="skill-station"
              className={cn(
                'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
                OUTER_GUIDE,
                OUTER_DIVIDER,
              )}
            >
              <span
                className={cn(
                  'col-span-full min-w-0 truncate @4xl:col-span-1',
                  OUTER_INDENT,
                )}
              >
                <InsightsLink
                  tab="traces"
                  filter={skillUsedFilter(skill.key, {
                    stationId: station.stationId,
                  })}
                  className="text-foreground"
                >
                  {formatStation(names, station.stationId)}
                </InsightsLink>
              </span>
              <NestedCell heading="Runs">
                {formatCount(station.runs)}
              </NestedCell>
              <NestedCell heading="Runs given">
                <Given counts={station}>{formatCount(station.enabled)}</Given>
              </NestedCell>
              <NestedCell heading="Runs read">
                {formatCount(station.used)}
              </NestedCell>
              <span className={SHARE_CELL}>
                <span className={SHARE_LINE}>
                  <span
                    aria-hidden
                    className="hidden shrink-0 @4xl:block"
                    style={{ width }}
                  />
                  <span className={SHARE_FIGURE}>
                    <SkillTrendMark
                      rate={station.usedRate}
                      used={station.used}
                      runs={station.runs}
                      trend={station.trend}
                    />
                  </span>
                </span>
              </span>
            </li>
          ))}
        </CollapsibleRows>
      )}
    </>
  );
}
