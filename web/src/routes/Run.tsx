import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { RunPage } from '@/components/features/runs/RunPage';
import { RunSkeleton } from '@/components/features/runs/RunSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useRunNotes } from '@/hooks/api/useRunNotes';
import { useRunRefresh } from '@/hooks/api/useRunRefresh';
import { useTaskFooterLoading } from '@/hooks/api/useTaskFooterLoading';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRun } from '@/hooks/api/useTeamRuns';
import { notFound } from '@/lib/error';
import { JournalDemandContext } from '@/lib/journal-demand';
import { failed, type Loadable, loading } from '@/lib/query';

type Query = UseQueryResult;

const stillLoading = (
  found: Query,
  conversation: Query,
  journal: Loadable,
  footerLoading: boolean,
): boolean =>
  loading(found) ||
  (Boolean(found.data) &&
    (loading(conversation) ||
      (conversation.data !== undefined &&
        (loading(journal) || footerLoading))));

const lostOf = (found: Query, conversation: Query) => {
  if (failed(found) && !notFound(found.error)) {
    return found;
  }

  return Boolean(found.data) && failed(conversation) ? conversation : null;
};

export function Run(): ReactElement | null {
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
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    conversation?.latestRun?.id,
  ]);

  const footerLoading = useTaskFooterLoading(
    teamId,
    conversation?.taskId,
    run?.station?.id,
  );

  useRunRefresh({
    teamId,
    runId,
    taskId: conversation?.taskId,
    state: run?.state,
    progress: run?.progress ?? null,
    following: conversation?.latestRun,
  });

  if (
    slug === undefined ||
    slug === '' ||
    teamId === undefined ||
    teamId === ''
  ) {
    return null;
  }

  if (stillLoading(found, conversationQuery, journal, footerLoading)) {
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
