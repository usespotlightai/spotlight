import { GradeRubric } from '@/components/features/inbox/grades/GradeRubric';
import { AgreementMeter } from '@/components/features/stations/config/AgreementMeter';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { SampleRing } from '@/components/features/stations/config/SampleRing';
import { JudgeClaims } from '@/components/features/stations/judge/JudgeClaims';
import { OverflowFade } from '@/components/shared/OverflowFade';
import { SectionLink } from '@/components/shared/SectionLink';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { formatStat } from '@/lib/judge';
import { failed, loading } from '@/lib/query';
import { JUDGE_ANCHOR, judgeAgreementPath } from '@/lib/station';
import { type JudgeSettings, sharePercent } from '@/lib/station-monitoring';

type JudgeCardProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
  judge: JudgeSettings | null;
};

export function JudgeCard({
  slug,
  teamId,
  lineId,
  stationId,
  judge,
}: JudgeCardProps) {
  const agreement = useStationJudge(teamId, lineId, stationId);

  if (!judge) {
    return (
      <ConfigCard title="Judge" id={JUDGE_ANCHOR}>
        <ConfigCardValue detail="Only people score runs here.">
          <span className="text-muted-foreground">No judge</span>
        </ConfigCardValue>
      </ConfigCard>
    );
  }

  return (
    <ConfigCard
      title="Judge"
      id={JUDGE_ANCHOR}
      className="sm:col-span-2"
      action={
        <SectionLink to={judgeAgreementPath(slug, teamId, { stationId })}>
          Agreement
        </SectionLink>
      }
    >
      <div className="grid flex-1 gap-x-10 gap-y-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            <SampleRing
              share={judge.sample}
              label={`Sample rate: ${sharePercent(judge.sample)} of runs`}
            />
            <ConfigCardValue detail="Sample rate">
              {sharePercent(judge.sample)}
            </ConfigCardValue>
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-2">
            {failed(agreement) ? (
              <p className="text-[0.7rem] text-muted-foreground">
                Qualified from {formatStat(judge.minAgreement)} agreement
              </p>
            ) : loading(agreement) || !agreement.data ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : (
              <AgreementMeter calibration={agreement.data.calibration} />
            )}

            {judge.claims.length > 0 && (
              <JudgeClaims
                claims={judge.claims}
                passThreshold={judge.passThreshold}
              />
            )}
          </div>
        </div>

        {judge.rubric !== null && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <h4 className="text-muted-foreground text-xs">Rubric</h4>
            <OverflowFade slot="judge-rubric" className="max-h-60">
              <GradeRubric rubric={judge.rubric} size="xs" />
            </OverflowFade>
          </div>
        )}
      </div>
    </ConfigCard>
  );
}
