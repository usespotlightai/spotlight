import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type StationNames, stationShown } from '@/lib/insights';
import type { StationStanding } from '@/lib/insights-changes';
import { judgeAgreementPath } from '@/lib/station';

type JudgeStandingsProps = {
  slug: string;
  teamId: string;
  judges: readonly StationStanding[];
  names: StationNames;
};

export function JudgeStandings({
  slug,
  teamId,
  judges,
  names,
}: JudgeStandingsProps) {
  if (judges.length === 0) {
    return null;
  }

  return (
    <div data-slot="judge-standings" className="flex flex-col gap-1 text-xs">
      <p className="text-muted-foreground">
        Judge scores count only for judges that agree with people often enough.
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
        {judges.map((judge) => (
          <li key={judge.stationId} className="flex items-center gap-1">
            <TrailLink
              to={judgeAgreementPath(slug, teamId, judge)}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {stationShown(names, judge.stationId)}
            </TrailLink>
            <span className="text-muted-foreground">
              {judge.trusted ? 'trusted' : 'hidden'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
