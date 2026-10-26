import type { ReactNode } from 'react';
import { AgentWorking } from '@/components/features/agent/AgentWorking';
import { ChatEmpty } from '@/components/features/agent/ChatEmpty';
import { ChatPersonMessage } from '@/components/features/agent/ChatPersonMessage';
import { ChatProposal } from '@/components/features/agent/ChatProposal';
import { ChatWork } from '@/components/features/agent/ChatWork';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import { type Chat, type ChatMoment, momentsOf, turnsOf } from '@/lib/chat';
import { type RunJournal, STICKY_AT_TOP } from '@/lib/inbox';
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
  const moments = momentsOf(chat.messages, journals);
  const turns = turnsOf(moments);
  const scroller = useStickToBottom<HTMLDivElement>(
    turns.filter((turn) => turn.message).length,
  );
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

          {turns.length === 0 && !chat.progress && <ChatEmpty />}

          {turns.map((turn, at) => {
            const last = at === turns.length - 1;
            const progress = last ? chat.progress : null;

            return (
              <section
                // biome-ignore lint/suspicious/noArrayIndexKey: the turns come in order and their order does not change
                key={at}
                className={cn('flex flex-col', at > 0 && 'mt-6')}
              >
                {turn.message && (
                  <div className={STICKY_AT_TOP}>
                    <ChatPersonMessage
                      slug={slug}
                      teamId={teamId}
                      message={turn.message}
                      targetStation={at === 0 ? chat.targetStation : null}
                    />
                  </div>
                )}

                {(turn.moments.length > 0 || progress) && (
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
                            ariaLabel="Agent message"
                            className="border-none bg-transparent p-0"
                          />
                        )}

                        {moment.kind === 'worked' && (
                          <ChatWork
                            steps={moment.steps}
                            live={
                              chat.progress === 'in-progress' &&
                              moment === lastWorked
                            }
                          />
                        )}
                      </li>
                    ))}

                    {progress && (
                      <AgentWorking
                        harness={chat.harness}
                        progress={progress}
                      />
                    )}
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
