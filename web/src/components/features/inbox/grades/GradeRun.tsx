import { ClaimsGrade } from '@/components/features/inbox/grades/ClaimsGrade';
import { GradeRubric } from '@/components/features/inbox/grades/GradeRubric';
import { GradeRunSkeleton } from '@/components/features/inbox/grades/GradeRunSkeleton';
import { GradeSaving } from '@/components/features/inbox/grades/GradeSaving';
import { QuickGrade } from '@/components/features/inbox/grades/QuickGrade';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { useGradeRun } from '@/hooks/api/useGradeRun';
import { useRunScores } from '@/hooks/api/useRunScores';
import { notFound } from '@/lib/error';
import { type GradeAnswer, gradeHeading } from '@/lib/judge';
import { failed, loading } from '@/lib/query';

type GradeRunProps = {
  slug: string;
  teamId: string;
  runId: string;
};

export function GradeRun({ slug, teamId, runId }: GradeRunProps) {
  const scores = useRunScores(teamId, runId);
  const grade = useGradeRun();

  if (loading(scores)) {
    return <GradeRunSkeleton />;
  }

  if (failed(scores) && notFound(scores.error)) {
    return <MembersOnly title="Only team members can grade this run" />;
  }

  if (failed(scores) || !scores.data) {
    return (
      <CouldNotLoad
        what="The run to grade"
        retrying={scores.isFetching}
        onRetry={() => void scores.refetch()}
        className="items-start"
      />
    );
  }

  const mine = scores.data.grades.find((each) => each.mine) ?? null;
  const { stationId, rubricBody, kind } = scores.data;
  const gradeWith = (answer: GradeAnswer) =>
    grade.mutate({ slug, teamId, runId, stationId, ...answer });

  return (
    <DecisionCard data-slot="grade-run" aria-label="Grade this run">
      <DecisionHeader
        title={
          <DecisionTitle status={mine ? 'approved' : 'pending'}>
            {gradeHeading(kind, rubricBody !== null)}
          </DecisionTitle>
        }
        trailing={<GradeSaving pending={grade.isPending} />}
      />

      {rubricBody !== null && <GradeRubric rubric={rubricBody} />}

      {scores.data.kind === 'claims' ? (
        <ClaimsGrade
          claims={scores.data.claims}
          mine={mine}
          pending={grade.isPending}
          onGrade={(claims) => gradeWith({ claims })}
        />
      ) : (
        <QuickGrade
          kind={scores.data.kind}
          mine={mine}
          pending={grade.isPending}
          onGrade={(value) => gradeWith({ value })}
        />
      )}
    </DecisionCard>
  );
}
