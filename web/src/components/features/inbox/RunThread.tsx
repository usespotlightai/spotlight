import type { ReactElement, ReactNode } from 'react';

import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { RunCitationTargets } from '@/components/features/runs/RunCitationTargets';
import { RunConversation } from '@/components/features/runs/RunConversation';
import { RunFooter } from '@/components/features/runs/RunFooter';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useRunNotes } from '@/hooks/api/useRunNotes';
import { useTaskFooterLoading } from '@/hooks/api/useTaskFooterLoading';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRun } from '@/hooks/api/useTeamRuns';
import { useRunDeciding } from '@/hooks/useRunDeciding';
import { useRunThread } from '@/hooks/useRunThread';
import type { DockedDecision } from '@/lib/decision-tray';
import { showsInThread } from '@/lib/inbox';
import { JournalDemandContext } from '@/lib/journal-demand';
import { failed, loading } from '@/lib/query';
import { shownProgress } from '@/lib/run';
import { lastNoteOf } from '@/lib/run-notes';

type RunThreadProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  trail: readonly BreadcrumbSegment[];
  after: ReactNode;
  docked?: readonly DockedDecision[];
  pending?: boolean;
};

export function RunThread({
  slug,
  teamId,
  taskId,
  runId,
  trail,
  after,
  docked,
  pending = false,
}: RunThreadProps): ReactElement {
  const conversationQuery = useRunNotes(teamId, runId);
  const journal = useTaskJournal(slug, taskId, [
    runId,
    conversationQuery.data?.latestRun.id,
  ]);
  const { data: run } = useTeamRun(teamId, runId);
  const decide = useRunDeciding(slug, run);
  const { latest, conversation, progress } = useRunThread(
    run,
    conversationQuery.data,
  );

  const footerLoading = useTaskFooterLoading(teamId, taskId, run?.station?.id);

  if (
    pending ||
    loading(conversationQuery) ||
    loading(journal) ||
    footerLoading
  ) {
    return <InboxItemSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      {failed(conversationQuery) || !conversation ? (
        <div className={THREAD_COLUMN}>
          <CouldNotLoad
            what="The run’s conversation"
            retrying={conversationQuery.isFetching}
            onRetry={() => void conversationQuery.refetch()}
            className="items-start"
          />
        </div>
      ) : (
        <RunSidePanel>
          <StepAnchorsProvider runId={runId} journals={journal.data ?? []}>
            <RunCitationTargets runId={runId} journals={journal.data ?? []}>
              <JournalDemandContext value={journal.demand}>
                <RunConversation
                  teamId={teamId}
                  conversation={conversation}
                  worked={journal.data ?? []}
                  progress={shownProgress(
                    progress,
                    latest?.id ?? null,
                    journal.data ?? [],
                  )}
                  openAt={lastNoteOf(
                    conversation.notes.filter(showsInThread),
                    runId,
                  )}
                  footer={
                    run && latest ? (
                      <RunFooter
                        slug={slug}
                        teamId={teamId}
                        run={run}
                        latest={latest}
                        conversation={conversation}
                      />
                    ) : null
                  }
                  deciding={decide}
                  afterRun={{ runId, content: after }}
                  docked={docked}
                />
              </JournalDemandContext>
            </RunCitationTargets>
          </StepAnchorsProvider>
        </RunSidePanel>
      )}
    </div>
  );
}
