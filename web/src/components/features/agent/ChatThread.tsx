import { type ReactNode, useState } from 'react';

import { AgentText } from '@/components/features/agent/AgentText';
import { AgentWorking } from '@/components/features/agent/AgentWorking';
import { ChatEmpty } from '@/components/features/agent/ChatEmpty';
import { ChatPersonMessage } from '@/components/features/agent/ChatPersonMessage';
import { ChatProposal } from '@/components/features/agent/ChatProposal';
import { ChatPullRequest } from '@/components/features/agent/ChatPullRequest';
import {
  StepsWork,
  StepsWorkPending,
} from '@/components/features/inbox/conversation/StepsWork';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { WorldMessage } from '@/components/features/inbox/conversation/WorldMessage';
import { Collapsible, COLLAPSE_MS } from '@/components/shared/Collapsible';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import { Turn } from '@/components/shared/Turn';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import { useJournalSight } from '@/hooks/useJournalSight';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import {
  type Chat,
  type ChatMoment,
  momentsOf,
  phaseOf,
  runsOfTurn,
  turnsOf,
} from '@/lib/chat';
import {
  type JournalledRun,
  type RunJournal,
  STICKY_AT_TOP,
} from '@/lib/inbox';
import { cn } from '@/lib/utils';

const ARRIVING =
  'motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in motion-safe:duration-200';

type ChatThreadProps = {
  slug: string;
  teamId: string;
  chat: Chat;
  journals: readonly RunJournal[];
  runs: readonly JournalledRun[];
  footer: ReactNode;
};

export function ChatThread({
  slug,
  teamId,
  chat,
  journals,
  runs,
  footer,
}: ChatThreadProps) {
  const resting = runs.filter(
    (run) => chat.progress !== 'in-progress' || run.runId !== chat.runId,
  );
  const moments = momentsOf(chat.messages, journals, resting);
  const turns = turnsOf(moments);
  const scroller = useStickToBottom<HTMLDivElement>(
    turns.filter((turn) => turn.message).length,
  );
  const sight = useJournalSight(scroller);
  const lingering = useDelayedValue(chat.progress, COLLAPSE_MS);
  const [opened, setOpened] = useState(() => ({
    chatId: chat.id,
    keys: new Set(moments.map((moment) => moment.key)),
  }));
  if (opened.chatId !== chat.id) {
    setOpened({
      chatId: chat.id,
      keys: new Set(moments.map((moment) => moment.key)),
    });
  }
  const lastWorked =
    turns
      .at(-1)
      ?.moments.reduce<ChatMoment | null>(
        (found, moment) => (moment.kind === 'worked' ? moment : found),
        null,
      ) ?? null;

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportRef={scroller}
      contentClassName="min-h-full flex"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={cn(THREAD_COLUMN, 'flex flex-1 flex-col')}>
          <TimeMarker at={chat.createdAt} />

          {turns.length === 0 && !chat.progress && <ChatEmpty />}

          {turns.map((turn, at) => {
            const last = at === turns.length - 1;
            const progress = last ? chat.progress : null;
            const working = last ? lingering : null;

            return (
              <Turn
                key={
                  turn.message ? `message:${turn.message.position}` : 'opening'
                }
                ref={sight(runsOfTurn(turn))}
                className={cn(at > 0 && 'mt-6')}
                head={
                  turn.message &&
                  (turn.message.kind === 'happened' ? (
                    <WorldMessage
                      body={turn.message.body}
                      attachments={[]}
                      authors={[]}
                      source={null}
                      deferredTo={null}
                    />
                  ) : (
                    <div className={STICKY_AT_TOP}>
                      <ChatPersonMessage
                        slug={slug}
                        teamId={teamId}
                        message={turn.message}
                        targetStation={at === 0 ? chat.targetStation : null}
                      />
                    </div>
                  ))
                }
              >
                {(turn.moments.length > 0 || working) && (
                  <ol className="mt-6 flex flex-col gap-6">
                    {turn.moments.map((moment, place) => (
                      <li
                        key={moment.key}
                        className={cn(
                          !opened.keys.has(moment.key) && ARRIVING,
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
                            attachments={moment.message.attachments}
                          />
                        )}

                        {moment.kind === 'opened' && (
                          <ChatPullRequest
                            slug={slug}
                            teamId={teamId}
                            chatId={chat.id}
                            title={moment.message.body}
                            pullRequest={moment.pullRequest}
                          />
                        )}

                        {moment.kind === 'answered' && (
                          <AgentText text={moment.text} />
                        )}

                        {moment.kind === 'pending' && (
                          <StepsWorkPending count={moment.count} />
                        )}

                        {moment.kind === 'worked' && (
                          <StepsWork
                            steps={moment.steps}
                            live={
                              last &&
                              chat.progress === 'in-progress' &&
                              moment === lastWorked
                            }
                          />
                        )}
                      </li>
                    ))}

                    {working && (
                      <li className="-mt-6">
                        <Collapsible open={Boolean(progress)} appear={false}>
                          <div className="pt-6">
                            <AgentWorking
                              harness={chat.harness}
                              progress={working}
                              phase={phaseOf(journals, chat.runId)}
                            />
                          </div>
                        </Collapsible>
                      </li>
                    )}
                  </ol>
                )}
              </Turn>
            );
          })}
        </div>

        <div className="sticky bottom-0 z-20">{footer}</div>
      </div>
    </ScrollArea>
  );
}
