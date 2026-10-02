import { GradeRunAbout } from '@/components/features/inbox/grades/GradeRunAbout';
import { GradeRunSkeleton } from '@/components/features/inbox/grades/GradeRunSkeleton';
import { QuickGrade } from '@/components/features/inbox/grades/QuickGrade';
import { RunChanges } from '@/components/features/runs/RunChanges';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { useGradeRun } from '@/hooks/api/useGradeRun';
import { useRunScores } from '@/hooks/api/useRunScores';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { changesOf } from '@/lib/changes';
import { notFound } from '@/lib/error';
import { summaryOf } from '@/lib/judge';
import { failed, loading } from '@/lib/query';

type GradeRunProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  title: string;
  description: string | null;
};

export function GradeRun({
  slug,
  teamId,
  taskId,
  runId,
  title,
  description,
}: GradeRunProps) {
  const scores = useRunScores(teamId, runId);
  const journal = useTaskJournal(slug, taskId);
  const grade = useGradeRun();

  if (loading(scores) || loading(journal)) {
    return <GradeRunSkeleton />;
  }

  if (failed(scores) && notFound(scores.error)) {
    return <MembersOnly title="Only the team’s members can grade this run" />;
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

  if (failed(journal)) {
    return (
      <CouldNotLoad
        what="What the run did"
        retrying={journal.isFetching}
        onRetry={() => void journal.refetch()}
        className="items-start"
      />
    );
  }

  const ran = (journal.data ?? []).filter((each) => each.runId === runId);
  const summary = summaryOf(ran);
  const mine = scores.data.grades.find((each) => each.mine) ?? null;

  return (
    <div data-slot="grade-run" className="flex flex-col gap-5">
      <GradeRunAbout />

      <section className="flex flex-col gap-1">
        <h3 className="font-medium text-foreground text-sm">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-sm leading-6">
            {description}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="font-medium text-foreground text-sm">
          What the run said last
        </h3>
        <p
          data-slot="run-summary"
          className="whitespace-pre-wrap break-words text-foreground text-sm leading-6"
        >
          {summary ?? 'The run said nothing to sum up.'}
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="font-medium text-foreground text-sm">Its changes</h3>
        {changesOf(ran).length > 0 ? (
          <RunChanges journals={ran} />
        ) : (
          <p className="text-muted-foreground text-sm">It changed no files.</p>
        )}
      </section>

      <QuickGrade
        kind={scores.data.kind}
        mine={mine}
        pending={grade.isPending}
        failed={grade.isError}
        onGrade={(value) =>
          grade.mutate({
            slug,
            teamId,
            runId,
            stationId: scores.data.stationId,
            value,
          })
        }
      />
    </div>
  );
}
