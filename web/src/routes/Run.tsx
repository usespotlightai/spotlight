import type { UseQueryResult } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { RunPage } from '@/components/features/runs/RunPage';
import { RunSkeleton } from '@/components/features/runs/RunSkeleton';
import { UntaskedRunOf } from '@/components/features/runs/UntaskedRunOf';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useRunConversation } from '@/hooks/api/useRunConversation';
import { useRunRefresh } from '@/hooks/api/useRunRefresh';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { failed, loading } from '@/lib/query';

type Query = UseQueryResult<unknown>;

const stillLoading = (
  runs: Query,
  found: boolean,
  conversation: Query,
  journal: Query,
): boolean =>
  loading(runs) ||
  (found &&
    (loading(conversation) ||
      (conversation.data !== undefined && loading(journal))));

const lostOf = (runs: Query, found: boolean, conversation: Query) => {
  if (failed(runs)) {
    return runs;
  }

  return found && failed(conversation) ? conversation : null;
};

export function Run() {
  const { slug, teamId, runId } = useParams();
  const runs = useTeamRuns(teamId);
  const run = runs.data?.find((each) => each.id === runId);
  const conversationQuery = useRunConversation(
    teamId,
    runs.data && !run ? undefined : runId,
  );
  const conversation = conversationQuery.data;
  const journal = useTaskJournal(slug, conversation?.taskId);

  useRunRefresh({
    teamId,
    runId,
    taskId: conversation?.taskId,
    state: run?.state,
  });

  if (!slug || !teamId) {
    return null;
  }

  if (stillLoading(runs, Boolean(run), conversationQuery, journal)) {
    return <RunSkeleton />;
  }

  const lost = lostOf(runs, Boolean(run), conversationQuery);

  if (lost) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The run"
          retrying={lost.isFetching}
          onRetry={() => void lost.refetch()}
        />
      </PageNotice>
    );
  }

  if (!run) {
    return <UntaskedRunOf slug={slug} teamId={teamId} runId={runId} />;
  }

  return (
    <RunPage
      slug={slug}
      teamId={teamId}
      run={run}
      conversation={conversation}
      worked={journal.data ?? []}
      journalFailed={failed(journal)}
    />
  );
}
