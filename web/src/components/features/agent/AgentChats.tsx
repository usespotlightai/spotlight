import { MousePointer2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { ChatRow } from '@/components/features/agent/ChatRow';
import { ChatRowSkeleton } from '@/components/features/agent/ChatRowSkeleton';
import { NewChatComposer } from '@/components/features/agent/NewChatComposer';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { ShowMore } from '@/components/shared/ShowMore';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChats } from '@/hooks/api/useChats';
import {
  chatPath,
  promptHandedOver,
  repositoriesHandedOver,
  setupHandedOver,
  targetStationHandedOver,
  tracesHandedOver,
} from '@/lib/chat';
import { failed, loading } from '@/lib/query';
import { useForwardTrail } from '@/lib/trail';
import { cn } from '@/lib/utils';

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
    void navigate(chatPath(slug, teamId, chatId), { state: { trail } });

  const planned = chats.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-16 flex-1" contentClassName="min-h-full">
        <div className={cn(THREAD_COLUMN, 'flex flex-col')}>
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
              className="py-16 [@media(max-height:520px)]:py-4"
            />
          )}

          {chats.data?.length === 0 && (
            <EmptyState
              icon={MousePointer2}
              title="No chats yet"
              className="self-center py-16 [@media(max-height:520px)]:py-4"
            >
              Say what you want to work on. The agent helps shape it into tasks.
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

          {planned.length > 0 && (
            <ShowMore list={chats} what="Older chats" className="mt-2" />
          )}
        </div>
      </ScrollArea>

      <ComposerFooter>
        <NewChatComposer
          key={location.key}
          slug={slug}
          teamId={teamId}
          traces={tracesHandedOver(location.state)}
          defaultTargetStation={targetStationHandedOver(location.state)}
          defaultPrompt={promptHandedOver(location.state)}
          defaultRepositories={repositoriesHandedOver(location.state)}
          setup={setupHandedOver(location.state)}
          onStarted={started}
        />
      </ComposerFooter>
    </div>
  );
}
