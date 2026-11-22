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
  NO_JUDGE,
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
        <p className="text-muted-foreground text-sm">{NO_JUDGE}</p>
      </TabSection>
    );
  }

  return (
    <TabSection
      title="Judge"
      id={JUDGE_ANCHOR}
      action={
        <SectionLink
          to={judgeAgreementPath(slug, teamId, { lineId, stationId })}
        >
          Agreement details
        </SectionLink>
      }
    >
      <PropertyList>
        <Property label="Judged" slot="judge-sample">
          {sharePercent(judge.sample)} of runs
        </Property>
        <Property label="Passes when" slot="pass-share">
          {formatPassThreshold(judge.passThreshold)}
        </Property>
        <Property label="Agreement">
          {failed(agreement) ? (
            <span className="text-muted-foreground">
              Sorry, it couldn’t be loaded.
            </span>
          ) : loading(agreement) || !agreement.data ? (
            <SkeletonLine className="w-40" />
          ) : (
            <AgreementValue calibration={agreement.data.calibration} />
          )}
        </Property>
        <Property label="Minimum agreement" slot="min-agreement">
          <span className="tabular-nums">{formatStat(judge.minAgreement)}</span>
        </Property>
      </PropertyList>

      <AuthoredText label={CLAIMS_LABEL}>
        <JudgeClaims claims={judge.claims} />
      </AuthoredText>
    </TabSection>
  );
}
