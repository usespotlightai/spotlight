import { useNavigate, useSearchParams } from 'react-router';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { SkillTrendMark } from '@/components/features/insights/tools/SkillTrendMark';
import { SkillWeeksChart } from '@/components/features/insights/tools/SkillWeeksChart';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { Folds } from '@/hooks/useFolds';
import {
  formatCount,
  formatStation,
  insightsPath,
  type StationNames,
  viewOf,
} from '@/lib/insights';
import {
  type SkillReport,
  skillEnabledFilter,
  skillUsedFilter,
} from '@/lib/insights-tools';
import { skillPath } from '@/lib/skills';
import { cn } from '@/lib/utils';

type SkillRowsProps = {
  slug: string;
  teamId: string;
  skill: SkillReport;
  names: StationNames;
  folds: Folds;
};

export function SkillRows({
  slug,
  teamId,
  skill,
  names,
  folds,
}: SkillRowsProps) {
  const open = folds.isOpen(skill.key);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { period } = viewOf(params);

  return (
    <>
      <NestedGroupRow
        label={skill.key}
        open={open}
        depth={0}
        onToggle={
          skill.stations.length > 0 ? () => folds.toggle(skill.key) : undefined
        }
        cells={
          <>
            <span className="col-span-full block h-4 w-32 @4xl:col-span-1">
              <SkillWeeksChart
                weeks={skill.weeks}
                onWeek={(week) =>
                  navigate(
                    insightsPath(slug, teamId, {
                      tab: 'runs',
                      period,
                      filter: skillUsedFilter(skill.key, { week }),
                      page: 1,
                    }),
                  )
                }
              />
            </span>
            <span aria-hidden className="hidden @4xl:block" />
            <NestedCell heading="Enabled" strong>
              <InsightsLink tab="runs" filter={skillEnabledFilter(skill.key)}>
                {formatCount(skill.enabled)}
              </InsightsLink>
            </NestedCell>
            <NestedCell heading="Read" strong>
              <InsightsLink tab="runs" filter={skillUsedFilter(skill.key)}>
                {formatCount(skill.used)}
              </InsightsLink>
            </NestedCell>
            <NestedCell heading="Trend" numeric={false}>
              <SkillTrendMark trend={skill.trend} />
            </NestedCell>
          </>
        }
      >
        {skill.defined ? (
          <TrailLink
            to={skillPath(slug, teamId, skill.key)}
            className="truncate font-medium text-foreground hover:underline"
          >
            {skill.key}
          </TrailLink>
        ) : (
          <span className="truncate font-medium text-foreground">
            {skill.key}
          </span>
        )}
      </NestedGroupRow>

      {skill.stations.length > 0 && (
        <FoldingRows open={open} label={`Stations using ${skill.key}`}>
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
                  'col-span-full min-w-0 truncate text-xs @4xl:col-span-1',
                  OUTER_INDENT,
                )}
              >
                <InsightsLink
                  tab="runs"
                  filter={skillUsedFilter(skill.key, {
                    stationId: station.stationId,
                  })}
                  className="text-foreground"
                >
                  {formatStation(names, station.stationId)}
                </InsightsLink>
              </span>
              <span aria-hidden className="hidden @4xl:block" />
              <NestedCell heading="Runs">
                {formatCount(station.runs)}
              </NestedCell>
              <NestedCell heading="Enabled">
                {formatCount(station.enabled)}
              </NestedCell>
              <NestedCell heading="Read">
                {formatCount(station.used)}
              </NestedCell>
              <NestedCell heading="Trend" numeric={false}>
                <SkillTrendMark trend={station.trend} />
              </NestedCell>
            </li>
          ))}
        </FoldingRows>
      )}
    </>
  );
}
