import type { UseQueryResult } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { RunPage } from '@/components/features/runs/RunPage';
import { RunSkeleton } from '@/components/features/runs/RunSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useRunNotes } from '@/hooks/api/useRunNotes';
import { useRunRefresh } from '@/hooks/api/useRunRefresh';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRun } from '@/hooks/api/useTeamRuns';
import { notFound } from '@/lib/error';
import { JournalDemandContext } from '@/lib/journal-demand';
import { failed, type Loadable, loading } from '@/lib/query';

type Query = UseQueryResult<unknown>;

const stillLoading = (
  found: Query,
  conversation: Query,
  journal: Loadable,
): boolean =>
  loading(found) ||
  (Boolean(found.data) &&
    (loading(conversation) ||
      (conversation.data !== undefined && loading(journal))));

const lostOf = (found: Query, conversation: Query) => {
  if (failed(found) && !notFound(found.error)) {
    return found;
  }

  return found.data && failed(conversation) ? conversation : null;
};

export function Run() {
  const { slug, teamId, runId } = useParams();
  const found = useTeamRun(teamId, runId);
  const run = found.data;
  const conversationQuery = useRunNotes(
    teamId,
    failed(found) ? undefined : runId,
  );
  const conversation = conversationQuery.data;
  const journal = useTaskJournal(slug, conversation?.taskId, [
    runId,
    conversation?.latestRun?.id,
  ]);

  useRunRefresh({
    teamId,
    runId,
    taskId: conversation?.taskId,
    state: run?.state,
    progress: run?.progress ?? null,
    following: conversation?.latestRun,
  });

  if (!slug || !teamId) {
    return null;
  }

  if (stillLoading(found, conversationQuery, journal)) {
    return <RunSkeleton />;
  }

  const lost = lostOf(found, conversationQuery);

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
    return (
      <PageNotice>
        <p className="text-muted-foreground text-sm">
          This team has no such run.
        </p>
      </PageNotice>
    );
  }

  return (
    <JournalDemandContext value={journal.demand}>
      <RunPage
        key={run.id}
        slug={slug}
        teamId={teamId}
        run={run}
        conversation={conversation}
        worked={journal.data ?? []}
        journalFailed={failed(journal)}
      />
    </JournalDemandContext>
  );
}
