import { GradeRubric } from '@/components/features/inbox/grades/GradeRubric';
import { AgreementMeter } from '@/components/features/stations/config/AgreementMeter';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { SampleRing } from '@/components/features/stations/config/SampleRing';
import { JudgeClaims } from '@/components/features/stations/judge/JudgeClaims';
import { SectionLink } from '@/components/shared/SectionLink';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
      action={
        <SectionLink to={judgeAgreementPath(slug, teamId, { stationId })}>
          Agreement
        </SectionLink>
      }
    >
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

        {judge.rubric !== null && (
          <Tooltip>
            <TooltipTrigger
              render={<button type="button" />}
              className="-mx-1.5 w-fit rounded-md px-1.5 py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Rubric
            </TooltipTrigger>
            <TooltipContent className="w-max max-w-[min(20rem,calc(100vw-2rem))] py-1.5">
              <GradeRubric rubric={judge.rubric} size="xs" />
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </ConfigCard>
  );
}
