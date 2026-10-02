import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { ReplayRunBanner } from '@/components/features/replays/run/ReplayRunBanner';
import { ReplayRunFooter } from '@/components/features/replays/run/ReplayRunFooter';
import { ReplayRunSkeleton } from '@/components/features/replays/run/ReplayRunSkeleton';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunConfig } from '@/components/features/runs/RunConfig';
import { RunImage } from '@/components/features/runs/RunImage';
import { RunSpend } from '@/components/features/runs/RunSpend';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useReplayRun } from '@/hooks/api/useReplayRun';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { titleShown } from '@/lib/replay';
import { runPath, working } from '@/lib/run';
import { teamCrumb } from '@/lib/team-crumb';
import { TrailContext, useTrail } from '@/lib/trail';

type ReplayRunProps = {
  slug: string;
  teamId: string;
  runId: string | undefined;
};

export function ReplayRun({ slug, teamId, runId }: ReplayRunProps) {
  const replayed = useReplayRun(teamId, runId);
  const { data: workspace } = useWorkspace(slug);
  const scroller = useStickToBottom<HTMLDivElement>();
  const run = replayed.data;
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team ? [teamCrumb(slug, team)] : []),
    ...(run
      ? [
          {
            label: titleShown(run.original.title),
            to: runPath(slug, teamId, run.original.runId),
          },
          { label: `Replay at ${run.station?.name ?? 'a removed station'}` },
        ]
      : []),
  ];
  const { trail, forward } = useTrail(base, 2);

  if (loading(replayed)) {
    return <ReplayRunSkeleton />;
  }

  if (failed(replayed) && !notFound(replayed.error)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The run"
          retrying={replayed.isFetching}
          onRetry={() => void replayed.refetch()}
        />
      </PageNotice>
    );
  }

  if (!run) {
    return (
      <PageNotice>
        <p className="text-muted-foreground text-sm">
          There is no such run for this team.
        </p>
      </PageNotice>
    );
  }

  const busy = working(run);
  const steps = run.journals.some((each) => each.steps.length > 0);

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <ChangesPanel>
          <StepAnchorsProvider runId={run.id} journals={run.journals}>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
                <TimeMarker at={run.startedAt} />
                <RunImage image={run.image} />

                <ReplayRunBanner
                  slug={slug}
                  teamId={teamId}
                  run={run}
                  className="mt-6"
                />

                <div className="mt-3 flex flex-col gap-3">
                  <RunConfig slug={slug} teamId={teamId} runId={run.id} />
                  <RunSpend spend={run.spend} />
                </div>

                {run.station && (
                  <RunActivity
                    journals={run.journals}
                    working={busy}
                    station={run.station}
                  />
                )}

                {!busy && !steps && (
                  <p className="mt-6 text-center text-muted-foreground text-sm">
                    {run.state === 'failed'
                      ? 'This replay failed before any work was done.'
                      : 'This replay ended before any work was done.'}
                  </p>
                )}
              </div>
            </div>

            <ReplayRunFooter />
          </StepAnchorsProvider>
        </ChangesPanel>
      </div>
    </TrailContext>
  );
}
