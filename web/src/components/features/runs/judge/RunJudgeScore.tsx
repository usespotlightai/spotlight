import { ClaimVerdicts } from '@/components/features/runs/judge/ClaimVerdicts';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { RunVerdictControl } from '@/components/features/runs/judge/RunVerdictControl';
import { DetailProperty } from '@/components/features/trace/view/detail/DetailProperty';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { useRunScores } from '@/hooks/api/useRunScores';
import { notFound } from '@/lib/error';
import {
  DISAGREES_LABEL,
  DISAGREES_NOTE,
  formatCalibration,
  formatPeopleVerdict,
  formatReplacedSource,
  formatVerdict,
  formatVerdictSource,
  HIDDEN_VERDICT,
  JUDGE_LABEL,
  PEOPLE_LABEL,
  type RunScores,
  VERDICTS_TITLE,
} from '@/lib/judge';
import { nonEmpty } from '@/lib/non-empty';
import { failed, loading } from '@/lib/query';

function VerdictsSkeleton() {
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

function PeopleVerdictValue({
  labelFrom,
  peoplePass,
  personVerdict,
}: Pick<RunScores, 'labelFrom' | 'peoplePass' | 'personVerdict'>) {
  if (!labelFrom || peoplePass === null) {
    return <span className="text-muted-foreground">None yet</span>;
  }

  return (
    <span data-slot="run-label">
      {formatPeopleVerdict(peoplePass)}
      <span className="text-muted-foreground">
        {' · '}
        {formatVerdictSource(labelFrom, personVerdict)}
      </span>
    </span>
  );
}

function JudgeVerdictValue({
  judge,
  agrees,
  calibration,
}: Pick<RunScores, 'judge' | 'agrees' | 'calibration'>) {
  if (!judge) {
    return (
      <span
        data-slot="judge-hidden"
        className="inline-flex items-center gap-1.5 text-muted-foreground"
      >
        {HIDDEN_VERDICT}
        <InfoTooltip tooltip={formatCalibration(calibration)} />
      </span>
    );
  }

  return (
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
  );
}

function PersonVerdictNotes({ scores }: { scores: RunScores }) {
  const { personVerdict, implicitFrom } = scores;

  if (!personVerdict) {
    return null;
  }

  return (
    <>
      {implicitFrom && (
        <p
          data-slot="run-label-replaced"
          className="text-muted-foreground text-xs"
        >
          {formatReplacedSource(implicitFrom)}
        </p>
      )}
      {nonEmpty(personVerdict.reason) && (
        <p data-slot="run-verdict-reason" className="text-sm">
          {personVerdict.reason}
        </p>
      )}
    </>
  );
}

type RunJudgeScoreProps = {
  teamId: string;
  runId: string;
};

export function RunJudgeScore({ teamId, runId }: RunJudgeScoreProps) {
  const query = useRunScores(teamId, runId);

  if (loading(query)) {
    return <VerdictsSkeleton />;
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

  if (!scores || (!scores.judged && !scores.takesVerdict)) {
    return null;
  }

  const { judge, calibration, agrees } = scores;
  const unclaimed = judge?.reasons.filter((each) => each.claim === null) ?? [];

  return (
    <DetailSection title={VERDICTS_TITLE}>
      <div data-slot="run-judge-score" className="flex flex-col gap-2">
        <dl>
          <DetailProperty name={PEOPLE_LABEL}>
            <PeopleVerdictValue
              labelFrom={scores.labelFrom}
              peoplePass={scores.peoplePass}
              personVerdict={scores.personVerdict}
            />
          </DetailProperty>
          {scores.judged && (
            <DetailProperty name={JUDGE_LABEL}>
              <JudgeVerdictValue
                judge={judge}
                agrees={agrees}
                calibration={calibration}
              />
            </DetailProperty>
          )}
        </dl>

        <PersonVerdictNotes scores={scores} />

        {scores.takesVerdict && (
          <RunVerdictControl teamId={teamId} scores={scores} />
        )}

        {judge && (
          <ClaimVerdicts
            claims={judge.claims}
            marks={judge.claimResults}
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
