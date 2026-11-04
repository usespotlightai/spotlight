import { GradeRubric } from '@/components/features/inbox/grades/GradeRubric';
import { AgreementValue } from '@/components/features/stations/config/AgreementValue';
import { AuthoredText } from '@/components/features/stations/config/AuthoredText';
import {
  Property,
  PropertyList,
} from '@/components/features/stations/config/PropertyList';
import { JudgeClaims } from '@/components/features/stations/judge/JudgeClaims';
import { TabSection } from '@/components/features/stations/TabSection';
import { SectionLink } from '@/components/shared/SectionLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import {
  CLAIMS_LABEL,
  formatPassThreshold,
  formatStat,
  RUBRIC_LABEL,
} from '@/lib/judge';
import { failed, loading } from '@/lib/query';
import { JUDGE_ANCHOR, judgeAgreementPath } from '@/lib/station';
import { type JudgeSettings, sharePercent } from '@/lib/station-monitoring';

type JudgeSectionProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
  judge: JudgeSettings | null;
};

export function JudgeSection({
  slug,
  teamId,
  lineId,
  stationId,
  judge,
}: JudgeSectionProps) {
  const agreement = useStationJudge(teamId, lineId, stationId);

  if (!judge) {
    return (
      <TabSection title="Judge" id={JUDGE_ANCHOR}>
        <p className="text-muted-foreground text-sm">
          No judge. Only people score runs here.
        </p>
      </TabSection>
    );
  }

  return (
    <TabSection
      title="Judge"
      id={JUDGE_ANCHOR}
      action={
        <SectionLink to={judgeAgreementPath(slug, teamId, { stationId })}>
          Agreement
        </SectionLink>
      }
    >
      <PropertyList>
        <Property label="Scores" slot="judge-sample">
          {sharePercent(judge.sample)} of runs
        </Property>
        {judge.claims.length > 0 && (
          <Property label="Passes" slot="pass-share">
            {formatPassThreshold(judge.passThreshold)}
          </Property>
        )}
        <Property label="Agreement">
          {failed(agreement) ? (
            <span className="text-muted-foreground">
              Qualified from {formatStat(judge.minAgreement)}
            </span>
          ) : loading(agreement) || !agreement.data ? (
            <SkeletonLine className="w-40" />
          ) : (
            <AgreementValue calibration={agreement.data.calibration} />
          )}
        </Property>
      </PropertyList>

      {judge.claims.length > 0 && (
        <AuthoredText label={CLAIMS_LABEL}>
          <JudgeClaims claims={judge.claims} />
        </AuthoredText>
      )}

      {judge.rubric !== null && (
        <AuthoredText label={RUBRIC_LABEL}>
          <GradeRubric rubric={judge.rubric} />
        </AuthoredText>
      )}
    </TabSection>
  );
}
