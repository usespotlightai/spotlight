import { TrailLink } from '@/components/shell/layout/TrailLink';
import { formatStation, type StationNames } from '@/lib/insights';
import type { StationJudgeCalibration } from '@/lib/insights-changes';
import { judgeAgreementPath } from '@/lib/station';

type JudgeCalibrationsProps = {
  slug: string;
  teamId: string;
  judges: readonly StationJudgeCalibration[];
  names: StationNames;
};

export function JudgeCalibrations({
  slug,
  teamId,
  judges,
  names,
}: JudgeCalibrationsProps) {
  if (judges.length === 0) {
    return null;
  }

  return (
    <div data-slot="judge-calibrations" className="flex flex-col gap-1 text-xs">
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
              {formatStation(names, judge.stationId)}
            </TrailLink>
            <span className="text-muted-foreground">
              {judge.qualified ? 'qualified' : 'hidden'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
