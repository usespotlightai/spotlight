import { ClaimVerdicts } from '@/components/features/runs/judge/ClaimVerdicts';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { DetailProperty } from '@/components/features/trace/view/detail/DetailProperty';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { useMembers } from '@/hooks/api/useMembers';
import { useRunScores } from '@/hooks/api/useRunScores';
import { notFound } from '@/lib/error';
import {
  type ClaimGrade,
  DISAGREES_LABEL,
  DISAGREES_NOTE,
  formatCalibration,
  formatClaimsMet,
  formatOutcome,
  formatVerdict,
  graderColumnName,
  graderName,
  HIDDEN_VERDICT,
  JUDGE_LABEL,
  PEOPLE_LABEL,
  VERDICTS_TITLE,
} from '@/lib/judge';
import { failed, loading } from '@/lib/query';

type RunJudgeScoreProps = {
  teamId: string;
  runId: string;
};

export function RunJudgeScore({ teamId, runId }: RunJudgeScoreProps) {
  const query = useRunScores(teamId, runId);
  const members = useMembers(teamId).data;

  if (loading(query)) {
    return (
      <DetailSection title={VERDICTS_TITLE}>
        <div role="status" aria-label="Loading the verdicts">
          <dl>
            <DetailProperty name={PEOPLE_LABEL}>
              <SkeletonLine className="w-36" />
            </DetailProperty>
            <DetailProperty name={JUDGE_LABEL}>
              <SkeletonLine className="w-36" />
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
        what="The verdicts"
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

  const { judge, calibration, grades, claims, outcome, agrees } = scores;
  const unclaimed = judge?.reasons.filter((each) => each.claim === null) ?? [];
  const [latest] = grades;
  const grade: ClaimGrade | null =
    latest && judge && latest.claimResults.length === judge.claimResults.length
      ? {
          grader: graderColumnName(latest, members),
          marks: latest.claimResults,
        }
      : null;

  return (
    <DetailSection title={VERDICTS_TITLE}>
      <div data-slot="run-judge-score" className="flex flex-col gap-2">
        <dl>
          {grades.map((each) => (
            <DetailProperty
              key={`${each.by}-${each.at}`}
              name={graderName(each, members)}
            >
              {judge ? (
                <span data-slot="grade-verdict">{formatVerdict(each)}</span>
              ) : (
                <span
                  data-slot="grade-verdict"
                  className="inline-flex items-center gap-1.5"
                >
                  {formatVerdict(each)}
                  <InfoTooltip tooltip={formatClaimsMet(each.claimResults)} />
                </span>
              )}
            </DetailProperty>
          ))}
          {grades.length === 0 && outcome && (
            <DetailProperty name={PEOPLE_LABEL}>
              <span data-slot="run-outcome">{formatOutcome(outcome)}</span>
            </DetailProperty>
          )}
          <DetailProperty name={JUDGE_LABEL}>
            {judge ? (
              <span className="inline-flex items-center gap-1.5">
                <span data-slot="judge-verdict">{formatVerdict(judge)}</span>
                {agrees === false && (
                  <WarningTooltip
                    data-slot="judge-disagrees"
                    label={DISAGREES_LABEL}
                    tooltip={DISAGREES_NOTE}
                    tone="warning"
                  />
                )}
              </span>
            ) : (
              <span
                data-slot="judge-hidden"
                className="inline-flex items-center gap-1.5 text-muted-foreground"
              >
                {HIDDEN_VERDICT}
                <InfoTooltip tooltip={formatCalibration(calibration)} />
              </span>
            )}
          </DetailProperty>
        </dl>

        {judge && (
          <ClaimVerdicts
            claims={claims}
            marks={judge.claimResults}
            grade={grade}
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
