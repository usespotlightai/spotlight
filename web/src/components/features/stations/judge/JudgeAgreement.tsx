import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { ClaimAgreements } from '@/components/features/stations/judge/ClaimAgreements';
import { ConfusionMatrix } from '@/components/features/stations/judge/ConfusionMatrix';
import { JudgeAgreementSkeleton } from '@/components/features/stations/judge/JudgeAgreementSkeleton';
import { JudgeCoverageBar } from '@/components/features/stations/judge/JudgeCoverage';
import { JudgeStatistics } from '@/components/features/stations/judge/JudgeStatistics';
import { JudgeTrend } from '@/components/features/stations/judge/JudgeTrend';
import { TabSection } from '@/components/features/stations/TabSection';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { MenuPicker } from '@/components/shared/MenuPicker';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { notFound } from '@/lib/error';
import {
  comparisonStats,
  coverageTitle,
  formatRubric,
  formatTrendCaption,
  TREND_MIN_PAIRS,
  trendWaitNote,
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
          Judge agreement with people shows here per rubric once the judge
          scores runs.
        </EmptyState>
      </div>
    );
  }

  const { agreement } = shown;

  return (
    <div
      data-slot="judge-agreement"
      className="@container flex flex-col gap-10"
    >
      <TabSection title={coverageTitle(coverage)}>
        <JudgeCoverageBar coverage={coverage} />
      </TabSection>

      <TabSection
        title={`Agreement on ${shown.current ? 'the current' : 'an earlier'} rubric`}
        action={
          versions.length > 1 && (
            <MenuPicker
              label="Rubric"
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
        <JudgeStatistics stats={comparisonStats(shown)} />
      </TabSection>

      {agreement.pairs > 0 && (
        <div className="grid gap-x-12 gap-y-10 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          <TabSection title="Where they disagree">
            <ConfusionMatrix
              confusion={shown.confusion}
              distribution={shown.distribution}
              observed={agreement.observed}
              pairs={agreement.pairs}
            />
          </TabSection>

          <TabSection
            title="Over time"
            description={formatTrendCaption(shown.kind)}
          >
            {agreement.pairs >= TREND_MIN_PAIRS && shown.trend.length > 1 ? (
              <JudgeTrend trend={shown.trend} kind={shown.kind} />
            ) : (
              <p className="text-muted-foreground text-sm">
                {trendWaitNote(agreement.pairs)}
              </p>
            )}
          </TabSection>
        </div>
      )}

      {agreement.claims.length > 0 && (
        <TabSection title="By claim">
          <ClaimAgreements
            agreements={agreement.claims}
            claims={shown.current && judge ? judge.claims : []}
            minAgreement={calibration.minAgreement}
          />
        </TabSection>
      )}
    </div>
  );
}
