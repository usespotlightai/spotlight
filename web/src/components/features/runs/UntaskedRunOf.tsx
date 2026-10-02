import { ReplayRun } from '@/components/features/replays/run/ReplayRun';
import { ReplayRunSkeleton } from '@/components/features/replays/run/ReplayRunSkeleton';
import { SearchRunPage } from '@/components/features/searches/run/SearchRunPage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useReplayRun } from '@/hooks/api/useReplayRun';
import { useSearchRun } from '@/hooks/api/useSearchRun';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';

type UntaskedRunOfProps = {
  slug: string;
  teamId: string;
  runId: string | undefined;
};

export function UntaskedRunOf({ slug, teamId, runId }: UntaskedRunOfProps) {
  const replayed = useReplayRun(teamId, runId);
  const searched = useSearchRun(teamId, runId);

  if (searched.data) {
    return <SearchRunPage slug={slug} teamId={teamId} run={searched.data} />;
  }

  const notReplay = failed(replayed) && notFound(replayed.error);

  if (loading(replayed) || (notReplay && loading(searched))) {
    return <ReplayRunSkeleton footer={null} />;
  }

  if (notReplay && failed(searched) && !notFound(searched.error)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The run"
          retrying={searched.isFetching}
          onRetry={() => void searched.refetch()}
        />
      </PageNotice>
    );
  }

  return <ReplayRun slug={slug} teamId={teamId} runId={runId} />;
}
