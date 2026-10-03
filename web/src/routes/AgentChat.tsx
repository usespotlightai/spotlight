import { useParams } from 'react-router';
import { AgentChatSkeleton } from '@/components/features/agent/AgentChatSkeleton';
import { ChatComposer } from '@/components/features/agent/ChatComposer';
import { ChatThread } from '@/components/features/agent/ChatThread';
import { ProposalDetail } from '@/components/features/agent/ProposalDetail';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useChat } from '@/hooks/api/useChat';
import { useChatJournal } from '@/hooks/api/useChatJournal';
import { useChatRefresh } from '@/hooks/api/useChatRefresh';
import { useAgentChatTrail } from '@/hooks/useAgentChatTrail';
import { useOpenProposal } from '@/hooks/useOpenProposal';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { TrailContext, useTrail } from '@/lib/trail';

export function AgentChat() {
  const { slug, teamId, chatId } = useParams();
  const thread = useChat(teamId, chatId);
  const chat = thread.data;
  const journal = useChatJournal(teamId, chatId);
  const { openAt, heldAt, shown, toggle, close } = useOpenProposal(
    chatId,
    chat,
  );

  useChatRefresh(chatId, chat);

  const { trail, forward } = useTrail(
    useAgentChatTrail(slug, teamId, chat?.title),
  );

  if (!slug || !teamId) {
    return null;
  }

  if (loading(thread) || (chat && loading(journal))) {
    return <AgentChatSkeleton />;
  }

  if (failed(thread)) {
    return (
      <PageNotice>
        {notFound(thread.error) ? (
          <p className="text-muted-foreground text-sm">
            There is no such chat for this team.
          </p>
        ) : (
          <CouldNotLoad
            what="The chat"
            retrying={thread.isFetching}
            onRetry={() => void thread.refetch()}
          />
        )}
      </PageNotice>
    );
  }

  if (!chat) {
    return null;
  }

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <ChatThread
          slug={slug}
          teamId={teamId}
          chat={chat}
          journals={journal.data ?? []}
          openAt={openAt}
          onOpen={toggle}
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
          aside={
            heldAt !== null &&
            shown && (
              <ProposalDetail
                teamId={teamId}
                chatId={chat.id}
                position={heldAt}
                proposal={shown}
                open={openAt !== null}
                onClose={close}
              />
            )
          }
        />
      </div>
    </TrailContext>
  );
}
