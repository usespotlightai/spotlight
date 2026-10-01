import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown, type InsightsFilter } from '@/lib/insights';
import {
  type SkillReport,
  skillGivenFilter,
  skillUsedFilter,
  trendShown,
} from '@/lib/insights-tools';
import { dayShown } from '@/lib/judge';

type SkillUseTableProps = {
  skills: readonly SkillReport[];
  weeks: readonly string[];
};

const counted = (count: number, filter: InsightsFilter) =>
  count > 0 ? (
    <InsightsLink tab="runs" filter={filter}>
      {countShown(count)}
    </InsightsLink>
  ) : (
    countShown(0)
  );

export function SkillUseTable({ skills, weeks }: SkillUseTableProps) {
  const columns: InsightsColumn<SkillReport>[] = [
    {
      id: 'skill',
      header: 'Skill',
      cell: (skill) => <span className="font-mono">{skill.key}</span>,
    },
    ...weeks.map(
      (week): InsightsColumn<SkillReport> => ({
        id: week,
        header: dayShown(week),
        numeric: true,
        cell: (skill) => {
          const used = skill.weeks.find((each) => each.week === week);

          return used && used.runs > 0 ? (
            <span title={`Read in ${used.used} of ${used.runs} runs`}>
              {counted(used.used, skillUsedFilter(skill.key, { week }))}
              <span className="text-muted-foreground"> / {used.runs}</span>
            </span>
          ) : (
            '–'
          );
        },
      }),
    ),
    {
      id: 'used',
      header: 'Read',
      numeric: true,
      cell: (skill) => counted(skill.used, skillUsedFilter(skill.key)),
    },
    {
      id: 'given',
      header: 'Given',
      numeric: true,
      cell: (skill) => counted(skill.given, skillGivenFilter(skill.key)),
    },
    {
      id: 'trend',
      header: 'Trend',
      cell: (skill) => (skill.trend ? trendShown(skill.trend) : '–'),
    },
  ];

  return (
    <InsightsTable
      label="Runs that read each skill, week by week"
      columns={columns}
      rows={skills}
      rowKey={(skill) => skill.key}
    />
  );
}
