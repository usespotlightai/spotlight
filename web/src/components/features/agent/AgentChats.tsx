import { MousePointer2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { ChatRow } from '@/components/features/agent/ChatRow';
import { ChatRowSkeleton } from '@/components/features/agent/ChatRowSkeleton';
import { NewChatComposer } from '@/components/features/agent/NewChatComposer';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { useChats } from '@/hooks/api/useChats';
import { chatPath, tracesHandedOver } from '@/lib/chat';
import { failed, loading } from '@/lib/query';
import { useForwardTrail } from '@/lib/trail';

const LIST = 'flex flex-col gap-0.5';

type AgentChatsProps = {
  slug: string;
  teamId: string;
};

export function AgentChats({ slug, teamId }: AgentChatsProps) {
  const chats = useChats(teamId);
  const navigate = useNavigate();
  const location = useLocation();
  const trail = useForwardTrail();

  const started = (chatId: string) =>
    navigate(chatPath(slug, teamId, chatId), { state: { trail } });

  const planned = chats.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
          {loading(chats) && (
            <ol role="status" aria-label="Loading the chats" className={LIST}>
              <ChatRowSkeleton />
            </ol>
          )}

          {failed(chats) && (
            <CouldNotLoad
              what="Chats"
              retrying={chats.isFetching}
              onRetry={() => void chats.refetch()}
              className="py-16"
            />
          )}

          {chats.data?.length === 0 && (
            <EmptyState
              icon={MousePointer2}
              title="No chats yet"
              className="self-center py-16"
            >
              Say what you want to work on, and the agent will help shape it
              into tasks.
            </EmptyState>
          )}

          {planned.length > 0 && (
            <ol className={LIST}>
              {planned.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  to={chatPath(slug, teamId, chat.id)}
                />
              ))}
            </ol>
          )}
        </div>
      </div>

      <ComposerFooter>
        <NewChatComposer
          key={location.key}
          slug={slug}
          teamId={teamId}
          traces={tracesHandedOver(location.state)}
          onStarted={started}
        />
      </ComposerFooter>
    </div>
  );
}
