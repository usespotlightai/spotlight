import { ReplayRunBanner } from '@/components/features/replays/run/ReplayRunBanner';
import { ReplayRunSkeleton } from '@/components/features/replays/run/ReplayRunSkeleton';
import { AutonomousComposer } from '@/components/features/runs/AutonomousComposer';
import { UntaskedRun } from '@/components/features/runs/UntaskedRun';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useReplayRun } from '@/hooks/api/useReplayRun';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { titleShown } from '@/lib/replay';
import { runPath } from '@/lib/run';
import { teamCrumb } from '@/lib/team-crumb';
import { useTrail } from '@/lib/trail';

type ReplayRunProps = {
  slug: string;
  teamId: string;
  runId: string | undefined;
};

export function ReplayRun({ slug, teamId, runId }: ReplayRunProps) {
  const replayed = useReplayRun(teamId, runId);
  const { data: workspace } = useWorkspace(slug);
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
          This team has no such run.
        </p>
      </PageNotice>
    );
  }

  return (
    <UntaskedRun
      slug={slug}
      teamId={teamId}
      trail={trail}
      forward={forward}
      run={run}
      banner={<ReplayRunBanner slug={slug} teamId={teamId} run={run} />}
      opening={run.original.title}
      title={titleShown(run.original.title)}
      briefing={run.briefing}
      footer={
        <AutonomousComposer
          slug={slug}
          agent={run.agent}
          repositories={run.repositories}
        />
      }
    />
  );
}
