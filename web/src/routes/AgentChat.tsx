import { useState } from 'react';
import { useParams } from 'react-router';

import { AgentChatSkeleton } from '@/components/features/agent/AgentChatSkeleton';
import { ChatComposer } from '@/components/features/agent/ChatComposer';
import { ChatThread } from '@/components/features/agent/ChatThread';
import { OpenInEditor } from '@/components/features/editor/OpenInEditor';
import { FileDropZone } from '@/components/shared/attachment/FileDropZone';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useChat } from '@/hooks/api/useChat';
import { useChatJournal } from '@/hooks/api/useChatJournal';
import { useChatRefresh } from '@/hooks/api/useChatRefresh';
import { useMarkChatReadOnView } from '@/hooks/api/useMarkChatReadOnView';
import { useAgentChatTrail } from '@/hooks/useAgentChatTrail';
import { notFound } from '@/lib/error';
import { JournalDemandContext } from '@/lib/journal-demand';
import { failed, loading } from '@/lib/query';
import { useTabTitle } from '@/lib/tab-title';
import { TrailContext, useTrail } from '@/lib/trail';

type ChatNotLoadedProps = {
  error: unknown;
  trail: readonly BreadcrumbSegment[];
  retrying: boolean;
  onRetry: () => void;
};

function ChatNotLoaded({
  error,
  trail,
  retrying,
  onRetry,
}: ChatNotLoadedProps) {
  if (notFound(error)) {
    return (
      <PageNotice title={<Breadcrumbs segments={trail} />}>
        <p className="text-muted-foreground text-sm">
          This team has no chat at that address.
        </p>
      </PageNotice>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <div className={THREAD_COLUMN}>
        <CouldNotLoad
          what="The chat"
          retrying={retrying}
          onRetry={onRetry}
          className="py-16 [@media(max-height:520px)]:py-4"
        />
      </div>
    </div>
  );
}

export function AgentChat() {
  const { slug, teamId, chatId } = useParams();
  const thread = useChat(teamId, chatId);
  const chat = thread.data;
  const journal = useChatJournal(teamId, chatId, [chat?.runId]);

  useChatRefresh(chatId, chat);
  useMarkChatReadOnView(slug, chat);

  const [openedId, setOpenedId] = useState<string>();
  if (chat && !loading(journal) && openedId !== chat.id) {
    setOpenedId(chat.id);
  }

  const { trail, forward } = useTrail(
    useAgentChatTrail(slug, teamId, chat?.title),
  );

  useTabTitle(chat ? undefined : 'Chat');

  if (!slug || !teamId) {
    return null;
  }

  if (loading(thread) || (chat && openedId !== chat.id && loading(journal))) {
    return <AgentChatSkeleton />;
  }

  if (failed(thread)) {
    return (
      <ChatNotLoaded
        error={thread.error}
        trail={trail}
        retrying={thread.isFetching}
        onRetry={() => void thread.refetch()}
      />
    );
  }

  if (!chat) {
    return null;
  }

  const editing = { kind: 'chat', id: chat.id } as const;

  return (
    <TrailContext value={forward}>
      <FileDropZone className="flex min-h-0 flex-1 flex-col rounded-lg">
        <PageHeader
          title={<Breadcrumbs segments={trail} />}
          actions={<OpenInEditor slug={slug} target={editing} />}
        />

        <JournalDemandContext value={journal.demand}>
          <ChatThread
            slug={slug}
            teamId={teamId}
            chat={chat}
            journals={journal.data ?? []}
            runs={journal.demand.runs}
            footer={
              <ComposerFooter>
                <ChatComposer
                  key={chat.id}
                  slug={slug}
                  teamId={teamId}
                  chat={chat}
                />
              </ComposerFooter>
            }
          />
        </JournalDemandContext>
      </FileDropZone>
    </TrailContext>
  );
}
