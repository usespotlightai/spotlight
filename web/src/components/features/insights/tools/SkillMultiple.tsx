import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { SkillTrendBadge } from '@/components/features/insights/tools/SkillTrendBadge';
import { SkillWeeksChart } from '@/components/features/insights/tools/SkillWeeksChart';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { countShown, type StationNames, stationShown } from '@/lib/insights';
import {
  type SkillReport,
  skillGivenFilter,
  skillUsedFilter,
} from '@/lib/insights-tools';
import { skillPath } from '@/lib/skills';

type SkillMultipleProps = {
  slug: string;
  teamId: string;
  skill: SkillReport;
  rule: string;
  names: StationNames;
};

export function SkillMultiple({
  slug,
  teamId,
  skill,
  rule,
  names,
}: SkillMultipleProps) {
  return (
    <li
      data-slot="skill-multiple"
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-2.5"
    >
      <div className="flex items-center gap-2">
        {skill.defined ? (
          <TrailLink
            to={skillPath(slug, teamId, skill.key)}
            className="min-w-0 flex-1 truncate font-medium font-mono text-foreground text-xs hover:underline"
          >
            {skill.key}
          </TrailLink>
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium font-mono text-foreground text-xs">
            {skill.key}
          </span>
        )}
        <SkillTrendBadge trend={skill.trend} rule={rule} />
      </div>

      <SkillWeeksChart weeks={skill.weeks} />

      <p className="text-muted-foreground text-xs">
        Read in{' '}
        <InsightsLink
          tab="runs"
          filter={skillUsedFilter(skill.key)}
          className="text-foreground tabular-nums"
        >
          {countShown(skill.used)}
        </InsightsLink>{' '}
        {skill.used === 1 ? 'run' : 'runs'}, given to{' '}
        <InsightsLink
          tab="runs"
          filter={skillGivenFilter(skill.key)}
          className="text-foreground tabular-nums"
        >
          {countShown(skill.given)}
        </InsightsLink>
      </p>

      {skill.stations.length > 0 && (
        <ul
          aria-label={`Stations using ${skill.key}`}
          className="flex flex-col gap-0.5"
        >
          {skill.stations.map((station) => (
            <li
              key={station.stationId}
              className="flex items-center gap-2 text-xs"
            >
              <InsightsLink
                tab="runs"
                filter={skillUsedFilter(skill.key, {
                  stationId: station.stationId,
                })}
                className="min-w-0 flex-1 truncate text-muted-foreground"
              >
                {stationShown(names, station.stationId)}
              </InsightsLink>
              <span className="text-muted-foreground tabular-nums">
                {countShown(station.used)} of {countShown(station.runs)}
              </span>
              <SkillTrendBadge trend={station.trend} rule={rule} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
