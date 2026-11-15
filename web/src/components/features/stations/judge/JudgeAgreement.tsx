import { GraduationCap } from 'lucide-react';
import { useState } from 'react';

import { ClaimAgreements } from '@/components/features/stations/judge/ClaimAgreements';
import { ConfusionMatrix } from '@/components/features/stations/judge/ConfusionMatrix';
import { JudgeAgreementSkeleton } from '@/components/features/stations/judge/JudgeAgreementSkeleton';
import { JudgeCoverageBar } from '@/components/features/stations/judge/JudgeCoverage';
import { JudgeStatistics } from '@/components/features/stations/judge/JudgeStatistics';
import { JudgeTrend } from '@/components/features/stations/judge/JudgeTrend';
import {
  DETAILS_GRID,
  SUBSECTIONS,
} from '@/components/features/stations/judge/layout';
import { ScoreVisibilityLine } from '@/components/features/stations/judge/ScoreVisibilityLine';
import { VersionAgreements } from '@/components/features/stations/judge/VersionAgreements';
import { TabSection } from '@/components/features/stations/TabSection';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { MenuPicker } from '@/components/shared/MenuPicker';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { notFound } from '@/lib/error';
import {
  CLAIMS_TITLE,
  CONFUSION_TITLE,
  COVERAGE_NOTE,
  comparisonStats,
  confusionNote,
  coverageTitle,
  formatRubric,
  pairsStat,
  type RubricVersion,
  type StationJudgeAgreement,
  scoreVisibility,
  TREND_CAPTION,
  TREND_TITLE,
  trendWaitNote,
  VERSIONS_TITLE,
} from '@/lib/judge';
import { failed, loading } from '@/lib/query';

const BOX = 'flex justify-center py-10';

type JudgeAgreementProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function JudgeAgreement({
  slug,
  teamId,
  lineId,
  stationId,
}: JudgeAgreementProps) {
  const query = useStationJudge(teamId, lineId, stationId);
  const [picked, setPicked] = useState<string | null>(null);

  if (loading(query)) {
    return <JudgeAgreementSkeleton />;
  }

  if (failed(query) && notFound(query.error)) {
    return (
      <div className={BOX}>
        <MembersOnly title="Only team members can see judge agreement" />
      </div>
    );
  }

  if (failed(query) || !query.data) {
    return (
      <div className={BOX}>
        <CouldNotLoad
          what="How the judge agrees with people"
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const { calibration, versions, coverage, judge } = query.data;
  const shown =
    versions.find((version) => version.rubricVersion === picked) ??
    versions.find((version) => version.current) ??
    versions[0];

  if (!shown) {
    return (
      <div className={BOX}>
        <EmptyState
          icon={GraduationCap}
          title="No judged runs yet"
          action={<CreateTaskLink slug={slug} teamId={teamId} />}
        >
          Agreement with people shows here for each version of the claims after
          the judge’s first verdict.
        </EmptyState>
      </div>
    );
  }

  return (
    <div
      data-slot="judge-agreement"
      className="@container flex flex-col gap-10"
    >
      <TabSection
        title="Agreement with people"
        scope={versions.length > 1 ? undefined : formatRubric(shown)}
        action={
          versions.length > 1 && (
            <MenuPicker
              label="Claims"
              value={shown.rubricVersion}
              options={versions.map((version) => ({
                id: version.rubricVersion,
                label: formatRubric(version),
              }))}
              selected={{
                id: shown.rubricVersion,
                label: formatRubric(shown),
              }}
              onChange={setPicked}
            />
          )
        }
      >
        {shown.current && (
          <ScoreVisibilityLine visibility={scoreVisibility(calibration)} />
        )}
        <JudgeStatistics
          pairs={pairsStat(shown, calibration)}
          stats={comparisonStats(shown, calibration)}
          minAgreement={calibration.minAgreement}
        />
        <div className={SUBSECTIONS}>
          {versions.length > 1 && (
            <TabSection level={3} title={VERSIONS_TITLE}>
              <VersionAgreements
                versions={versions}
                minAgreement={calibration.minAgreement}
              />
            </TabSection>
          )}
          <AgreementDetails
            shown={shown}
            judge={judge}
            minAgreement={calibration.minAgreement}
          />
          <TabSection
            level={3}
            title={coverageTitle(coverage)}
            description={COVERAGE_NOTE}
          >
            <JudgeCoverageBar coverage={coverage} />
          </TabSection>
        </div>
      </TabSection>
    </div>
  );
}

type AgreementDetailsProps = {
  shown: RubricVersion;
  judge: StationJudgeAgreement['judge'];
  minAgreement: number | null;
};

function AgreementDetails({
  shown,
  judge,
  minAgreement,
}: AgreementDetailsProps) {
  const { agreement } = shown;

  return (
    <>
      {agreement.claims.length > 0 && (
        <TabSection level={3} title={CLAIMS_TITLE}>
          <ClaimAgreements
            agreements={agreement.claims}
            claims={shown.current && judge ? judge.claims : []}
            minAgreement={minAgreement}
          />
        </TabSection>
      )}

      {agreement.pairs > 0 && (
        <div className={DETAILS_GRID}>
          <TabSection
            level={3}
            title={CONFUSION_TITLE}
            description={confusionNote()}
          >
            <ConfusionMatrix
              measured={agreement.measured}
              confusion={shown.confusion}
              distribution={shown.distribution}
            />
          </TabSection>

          <TabSection level={3} title={TREND_TITLE} description={TREND_CAPTION}>
            {shown.trendShown ? (
              <JudgeTrend trend={shown.trend} />
            ) : (
              <p className="text-muted-foreground text-sm">
                {trendWaitNote(shown)}
              </p>
            )}
          </TabSection>
        </div>
      )}
    </>
  );
}
