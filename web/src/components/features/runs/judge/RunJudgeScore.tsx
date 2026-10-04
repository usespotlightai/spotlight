import { GraduationCap } from 'lucide-react';
import { ClaimVerdicts } from '@/components/features/runs/judge/ClaimVerdicts';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
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

const LINE = 'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs';
const ICON = (
  <GraduationCap aria-hidden className="size-3.5 text-muted-foreground" />
);

export function RunJudgeScore({ teamId, runId }: RunJudgeScoreProps) {
  const query = useRunScores(teamId, runId);

  if (loading(query)) {
    return (
      <p role="status" aria-label="Loading the judge’s score" className={LINE}>
        {ICON}
        <span className="font-medium text-foreground">Judged</span>
        <SkeletonLine className="w-10" />
      </p>
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
    <div data-slot="run-judge-score" className="flex flex-col gap-1.5">
      <p className={LINE}>
        {ICON}
        <span className="font-medium text-foreground">Judged</span>
        {judge ? (
          <span data-slot="judge-verdict" className="text-foreground">
            {scoreShown(judge)}
          </span>
        ) : (
          <span className="text-muted-foreground">score hidden</span>
        )}
        {grades.length > 0 && (
          <span className="text-muted-foreground">
            · People said{' '}
            {grades
              .map((each) => `${scoreShown(each)}${each.mine ? ' (you)' : ''}`)
              .join(', ')}
          </span>
        )}
      </p>

      {!standing.trusted && (
        <p className="pl-5 text-muted-foreground text-xs">
          {standingShown(standing)}
        </p>
      )}

      {judge?.marks && (
        <div className="pl-5">
          <ClaimVerdicts
            claims={claims}
            marks={judge.marks}
            reasons={judge.reasons}
          />
        </div>
      )}

      {unclaimed.length > 0 && (
        <JudgeReasons reasons={unclaimed} label="Why" className="pl-5" />
      )}
    </div>
  );
}
