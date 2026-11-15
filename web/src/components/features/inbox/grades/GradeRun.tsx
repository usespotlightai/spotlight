import { useState } from 'react';

import { ClaimsGrade } from '@/components/features/inbox/grades/ClaimsGrade';
import { GradeRunSkeleton } from '@/components/features/inbox/grades/GradeRunSkeleton';
import { GradeSaving } from '@/components/features/inbox/grades/GradeSaving';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { useGradeRun } from '@/hooks/api/useGradeRun';
import { useRunScores } from '@/hooks/api/useRunScores';
import { notFound } from '@/lib/error';
import {
  ANSWER_EVERY_CLAIM_TO_SAVE,
  CHANGE_AN_ANSWER_TO_SAVE,
  EARLIER_CLAIMS_NOTE,
  type Grade,
  GRADED_BY_YOU,
  SAVE_GRADE,
  WAITING_FOR_GRADE,
} from '@/lib/judge';
import { failed, loading } from '@/lib/query';

type Answers = readonly (boolean | null)[];

const answered = (answers: Answers): answers is readonly boolean[] =>
  answers.every((each) => each !== null);

const sameAs = (answers: Answers, mine: Grade | null): boolean =>
  mine !== null &&
  answers.length === mine.claimResults.length &&
  answers.every((each, at) => each === mine.claimResults[at]);

const saveBlockedReason = (answers: Answers, mine: Grade | null) => {
  if (!answered(answers)) {
    return ANSWER_EVERY_CLAIM_TO_SAVE;
  }

  return sameAs(answers, mine) ? CHANGE_AN_ANSWER_TO_SAVE : null;
};

type GradeRunProps = {
  slug: string;
  teamId: string;
  runId: string;
};

export function GradeRun({ slug, teamId, runId }: GradeRunProps) {
  const scores = useRunScores(teamId, runId);
  const grade = useGradeRun();
  const [edited, setEdited] = useState<Answers | null>(null);

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
  const { stationId, gradable, claims, earlierClaims } = scores.data;
  const answers =
    edited ?? claims.map((_, at) => mine?.claimResults[at] ?? null);
  const blocked = grade.isPending ? null : saveBlockedReason(answers, mine);
  const canSave = !grade.isPending && blocked === null;

  const change = (at: number, met: boolean) =>
    setEdited(answers.map((each, place) => (place === at ? met : each)));

  const save = () => {
    if (answered(answers)) {
      grade.mutate({ slug, teamId, runId, stationId, claims: answers });
    }
  };

  return (
    <DecisionCard data-slot="grade-run" aria-label="Grade this run">
      <DecisionHeader
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <DecisionTitle status={mine ? 'approved' : 'pending'}>
              {mine ? GRADED_BY_YOU : WAITING_FOR_GRADE}
            </DecisionTitle>
            {gradable && earlierClaims && (
              <span data-slot="earlier-claims" className="flex shrink-0">
                <InfoTooltip tooltip={EARLIER_CLAIMS_NOTE} />
              </span>
            )}
          </span>
        }
        trailing={<GradeSaving pending={grade.isPending} mine={mine} />}
      />

      {gradable ? (
        <>
          <ClaimsGrade
            claims={claims}
            answers={answers}
            pending={grade.isPending}
            onChange={change}
          />
          <DecisionControls>
            <DisabledReasonTooltip reason={blocked}>
              {(describedBy) => (
                <DecisionButton
                  type="button"
                  variant="default"
                  disabled={!canSave}
                  aria-describedby={describedBy}
                  onClick={save}
                >
                  {SAVE_GRADE}
                </DecisionButton>
              )}
            </DisabledReasonTooltip>
          </DecisionControls>
        </>
      ) : (
        <p data-slot="not-gradable" className="text-muted-foreground text-sm">
          This run cannot be graded. Its station has no judge with claims.
        </p>
      )}
    </DecisionCard>
  );
}
