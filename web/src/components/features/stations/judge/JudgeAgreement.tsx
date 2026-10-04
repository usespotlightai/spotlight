import { GraduationCap } from 'lucide-react';
import { JudgeAgreementSkeleton } from '@/components/features/stations/judge/JudgeAgreementSkeleton';
import { JudgeCoverageFigures } from '@/components/features/stations/judge/JudgeCoverageFigures';
import { JudgeStandingNote } from '@/components/features/stations/judge/JudgeStandingNote';
import { RubricVersionCard } from '@/components/features/stations/judge/RubricVersionCard';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';

const BOX = 'flex justify-center rounded-xl border border-border py-10';

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

  if (loading(query)) {
    return <JudgeAgreementSkeleton />;
  }

  if (failed(query) && notFound(query.error)) {
    return (
      <div className={BOX}>
        <MembersOnly title="Only the team’s members can see how the judge agrees with people" />
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

  const { standing, versions, coverage, judge } = query.data;

  if (versions.length === 0) {
    return (
      <div className={BOX}>
        <EmptyState
          icon={GraduationCap}
          title="No judged runs yet"
          action={<CreateTaskLink slug={slug} teamId={teamId} />}
        >
          Once the judge scores runs here, how often it agrees with people shows
          here, rubric by rubric.
        </EmptyState>
      </div>
    );
  }

  return (
    <div data-slot="judge-agreement" className="flex flex-col gap-3">
      <JudgeStandingNote standing={standing} />
      <JudgeCoverageFigures coverage={coverage} />

      <ol aria-label="Agreement by rubric" className="flex flex-col gap-3">
        {versions.map((version) => (
          <RubricVersionCard
            key={version.rubricVersion}
            version={version}
            claims={version.current && judge ? judge.claims : []}
          />
        ))}
      </ol>
    </div>
  );
}
