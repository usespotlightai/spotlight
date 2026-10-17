import { ClaimVerdicts } from '@/components/features/runs/judge/ClaimVerdicts';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { DetailProperty } from '@/components/features/trace/view/detail/DetailProperty';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useRunScores } from '@/hooks/api/useRunScores';
import { notFound } from '@/lib/error';
import { scoreShown, standingShown } from '@/lib/judge';
import { failed, loading } from '@/lib/query';

type RunJudgeScoreProps = {
  teamId: string;
  runId: string;
};

export function RunJudgeScore({ teamId, runId }: RunJudgeScoreProps) {
  const query = useRunScores(teamId, runId);

  if (loading(query)) {
    return (
      <DetailSection title="Judge">
        <div role="status" aria-label="Loading the judge’s score">
          <dl>
            <DetailProperty name="Score">
              <SkeletonLine className="w-10" />
            </DetailProperty>
          </dl>
        </div>
      </DetailSection>
    );
  }

  if (failed(query) && notFound(query.error)) {
    return null;
  }

  if (failed(query)) {
    return (
      <CouldNotLoad
        what="The judge’s score"
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        className="items-start"
      />
    );
  }

  const scores = query.data;

  if (!scores?.judged) {
    return null;
  }

  const { judge, standing, grades, claims } = scores;
  const unclaimed = judge?.marks
    ? judge.reasons.filter((each) => each.claim === null)
    : (judge?.reasons ?? []);

  return (
    <DetailSection title="Judge">
      <div data-slot="run-judge-score" className="flex flex-col gap-1.5">
        <dl>
          <DetailProperty name="Score">
            {judge ? (
              <span data-slot="judge-verdict">{scoreShown(judge)}</span>
            ) : (
              <span className="text-muted-foreground">Hidden</span>
            )}
          </DetailProperty>
          {grades.length > 0 && (
            <DetailProperty name="People">
              {grades
                .map(
                  (each) => `${scoreShown(each)}${each.mine ? ' (you)' : ''}`,
                )
                .join(', ')}
            </DetailProperty>
          )}
        </dl>

        {!standing.trusted && (
          <p className="text-muted-foreground text-xs leading-5">
            {standingShown(standing)}
          </p>
        )}

        {judge?.marks && (
          <ClaimVerdicts
            claims={claims}
            marks={judge.marks}
            reasons={judge.reasons}
          />
        )}

        {unclaimed.length > 0 && (
          <JudgeReasons reasons={unclaimed} label="Why" />
        )}
      </div>
    </DetailSection>
  );
}
