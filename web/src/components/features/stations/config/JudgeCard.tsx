import { useId, useState } from 'react';
import { AgreementMeter } from '@/components/features/stations/config/AgreementMeter';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { SampleRing } from '@/components/features/stations/config/SampleRing';
import { JudgeClaims } from '@/components/features/stations/judge/JudgeClaims';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
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
  const [open, setOpen] = useState(false);
  const rubricId = useId();
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
          How it agrees with people
        </SectionLink>
      }
    >
      <div className="flex items-center gap-3">
        <SampleRing
          share={judge.sample}
          label={`Judges ${sharePercent(judge.sample)} of runs`}
        />
        <ConfigCardValue detail="of runs judged">
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
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls={rubricId}
              className="-mx-1.5 w-fit rounded-md px-1.5 py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {open ? 'Hide rubric' : 'Show rubric'}
            </button>

            {open && (
              <div id={rubricId}>
                <MarkdownEditor
                  key={stationId}
                  initialValue={judge.rubric}
                  readOnly
                  ariaLabel="Rubric"
                  placeholder=""
                  className="border-0 bg-transparent p-0"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </ConfigCard>
  );
}
