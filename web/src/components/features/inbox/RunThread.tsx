import type { ReactNode } from 'react';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { RunFooter } from '@/components/features/runs/RunFooter';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useRunConversation } from '@/hooks/api/useRunConversation';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { decisionOwed } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { conversingOf, lastNoteOf } from '@/lib/run-conversation';

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
  const conversation = useRunConversation(teamId, runId);
  const journal = useTaskJournal(slug, taskId);
  const runs = useTeamRuns(teamId);
  const said = conversation.data;
  const run = runs.data?.find((each) => each.id === runId);

  if (loading(conversation) || loading(journal)) {
    return <InboxItemSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      {failed(conversation) || !said ? (
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          <CouldNotLoad
            what="The run’s conversation"
            retrying={conversation.isFetching}
            onRetry={() => void conversation.refetch()}
            className="items-start"
          />
        </div>
      ) : (
        <RunSidePanel>
          <Conversation
            item={conversingOf(said, teamId)}
            worked={journal.data ?? []}
            openAt={lastNoteOf(said.notes, runId)}
            opening={
              said.briefing ? (
                <RunBriefing
                  briefing={said.briefing}
                  attachments={said.attachments}
                />
              ) : undefined
            }
            footer={
              run ? (
                <RunFooter
                  slug={slug}
                  teamId={teamId}
                  run={run}
                  said={said}
                  deciding={decisionOwed(said.notes)}
                />
              ) : null
            }
            afterRun={(ran) => (ran === runId ? after : null)}
          />
        </RunSidePanel>
      )}
    </div>
  );
}
