import type { ReactNode } from 'react';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { RunConversation } from '@/components/features/runs/RunConversation';
import { RunFooter } from '@/components/features/runs/RunFooter';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useRunNotes } from '@/hooks/api/useRunNotes';
import { useRunRefresh } from '@/hooks/api/useRunRefresh';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useRunDeciding } from '@/hooks/useRunDeciding';
import { useRunThread } from '@/hooks/useRunThread';
import { decisionPending } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { shownActivity } from '@/lib/run';
import { lastNoteOf } from '@/lib/run-notes';

type RunThreadProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  trail: readonly BreadcrumbSegment[];
  after: ReactNode;
};

export function RunThread({
  slug,
  teamId,
  taskId,
  runId,
  trail,
  after,
}: RunThreadProps) {
  const conversationQuery = useRunNotes(teamId, runId);
  const journal = useTaskJournal(slug, taskId);
  const runs = useTeamRuns(teamId);
  const run = runs.data?.find((each) => each.id === runId);
  const decide = useRunDeciding(slug, run);
  const { latest, shown, conversation } = useRunThread(
    run,
    conversationQuery.data,
  );

  useRunRefresh({
    teamId,
    runId,
    taskId,
    state: run?.state,
    activity: run?.activity,
    following: conversationQuery.data?.latestRun,
  });

  if (loading(conversationQuery) || loading(journal)) {
    return <InboxItemSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      {failed(conversationQuery) || !conversation ? (
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          <CouldNotLoad
            what="The run’s conversation"
            retrying={conversationQuery.isFetching}
            onRetry={() => void conversationQuery.refetch()}
            className="items-start"
          />
        </div>
      ) : (
        <RunSidePanel>
          <RunConversation
            teamId={teamId}
            conversation={conversation}
            worked={journal.data ?? []}
            activity={
              latest
                ? shownActivity(shown, latest.id, journal.data ?? [])
                : null
            }
            openAt={lastNoteOf(conversation.notes, runId)}
            footer={
              run && latest ? (
                <RunFooter
                  slug={slug}
                  teamId={teamId}
                  run={run}
                  latest={latest}
                  conversation={conversation}
                  deciding={decisionPending(conversation.notes)}
                />
              ) : null
            }
            deciding={decide}
            afterRun={(ran) => (ran === runId ? after : null)}
          />
        </RunSidePanel>
      )}
    </div>
  );
}
