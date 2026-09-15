import { useNavigate } from 'react-router';
import { ChatRow } from '@/components/features/agent/ChatRow';
import { NewChatComposer } from '@/components/features/agent/NewChatComposer';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { useChats } from '@/hooks/api/useChats';
import { chatPath } from '@/lib/chat';
import { useForwardTrail } from '@/lib/trail';

type AgentChatsProps = {
  slug: string;
  teamId: string;
};

export function AgentChats({ slug, teamId }: AgentChatsProps) {
  const { data: chats, isPending } = useChats(teamId);
  const navigate = useNavigate();
  const trail = useForwardTrail();

  const started = (chatId: string) =>
    navigate(chatPath(slug, teamId, chatId), { state: { trail } });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
          {!isPending &&
            (chats && chats.length > 0 ? (
              <ol className="flex flex-col gap-0.5">
                {chats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    to={chatPath(slug, teamId, chat.id)}
                  />
                ))}
              </ol>
            ) : (
              <p className="py-16 text-center text-muted-foreground text-sm">
                Nothing planned yet. Say what you want to work on, and the agent
                will help shape it into tasks.
              </p>
            ))}
        </div>
      </div>

      <ComposerFooter>
        <NewChatComposer slug={slug} teamId={teamId} onStarted={started} />
      </ComposerFooter>
    </div>
  );
}
