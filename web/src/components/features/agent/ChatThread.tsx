import type { ReactNode } from 'react';
import { AgentWorking } from '@/components/features/agent/AgentWorking';
import { ChatEmpty } from '@/components/features/agent/ChatEmpty';
import { ChatProposal } from '@/components/features/agent/ChatProposal';
import { ChatSaid } from '@/components/features/agent/ChatSaid';
import { ChatWork } from '@/components/features/agent/ChatWork';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import { type Chat, type ChatMoment, momentsOf, turnsOf } from '@/lib/chat';
import { HELD_AT_TOP, type RunJournal } from '@/lib/inbox';
import { cn } from '@/lib/utils';

type ChatThreadProps = {
  slug: string;
  teamId: string;
  chat: Chat;
  journals: readonly RunJournal[];
  footer: ReactNode;
};

export function ChatThread({
  slug,
  teamId,
  chat,
  journals,
  footer,
}: ChatThreadProps) {
  const scroller = useStickToBottom<HTMLDivElement>();
  const moments = momentsOf(chat.messages, journals);
  const turns = turnsOf(moments);
  const lastWorked = moments.reduce<ChatMoment | null>(
    (found, moment) => (moment.kind === 'worked' ? moment : found),
    null,
  );

  return (
    <div
      ref={scroller}
      className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 py-8">
          <TimeMarker at={chat.createdAt} />

          {turns.length === 0 && !chat.working && <ChatEmpty />}

          {turns.map((turn, at) => {
            const last = at === turns.length - 1;
            const working = last && chat.working;

            return (
              <section
                // biome-ignore lint/suspicious/noArrayIndexKey: the turns come in order and their order does not change
                key={at}
                className={cn('flex flex-col', at > 0 && 'mt-6')}
              >
                {turn.said && (
                  <div className={HELD_AT_TOP}>
                    <ChatSaid
                      slug={slug}
                      teamId={teamId}
                      message={turn.said}
                      improving={at === 0 ? chat.improving : null}
                    />
                  </div>
                )}

                {(turn.moments.length > 0 || working) && (
                  <ol className="mt-6 flex flex-col gap-6">
                    {turn.moments.map((moment, place) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: the position of a moment identifies it, because new moments go only at the end
                        key={place}
                        className={cn(
                          moment.kind === 'proposed' &&
                            turn.moments[place - 1]?.kind === 'proposed' &&
                            '-mt-3',
                        )}
                      >
                        {moment.kind === 'proposed' && (
                          <ChatProposal
                            slug={slug}
                            teamId={teamId}
                            chatId={chat.id}
                            position={moment.message.position}
                            proposal={moment.proposal}
                          />
                        )}

                        {moment.kind === 'answered' && (
                          <MarkdownEditor
                            key={moment.text.length}
                            readOnly
                            initialValue={moment.text}
                            placeholder=""
                            ariaLabel="What the agent said"
                            className="border-none bg-transparent p-0"
                          />
                        )}

                        {moment.kind === 'worked' && (
                          <ChatWork
                            steps={moment.steps}
                            live={chat.working && moment === lastWorked}
                          />
                        )}
                      </li>
                    ))}

                    {working && <AgentWorking harness={chat.harness} />}
                  </ol>
                )}
              </section>
            );
          })}
        </div>

        <div className="sticky bottom-0 z-20">{footer}</div>
      </div>
    </div>
  );
}
