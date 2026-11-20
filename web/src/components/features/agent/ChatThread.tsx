import { type ReactNode, useRef, useState } from 'react';

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
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { DecisionTray } from '@/components/shared/decision-tray/DecisionTray';
import { DecisionTraySpace } from '@/components/shared/decision-tray/DecisionTraySpace';
import { Dockable } from '@/components/shared/decision-tray/Dockable';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import { Turn } from '@/components/shared/Turn';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDecisionTray } from '@/hooks/useDecisionTray';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import { useJournalSight } from '@/hooks/useJournalSight';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import {
  type Chat,
  type ChatMoment,
  momentsOf,
  phaseOf,
  type Proposal,
  runsOfTurn,
  turnsOf,
} from '@/lib/chat';
import {
  DecisionTrayContext,
  type DockedDecision,
  dockedRuns,
} from '@/lib/decision-tray';
import {
  type JournalledRun,
  type RunJournal,
  STICKY_AT_TOP,
} from '@/lib/inbox';
import { TURNS_SHOWN_FIRST } from '@/lib/turns';
import { cn } from '@/lib/utils';

const STILL_OPEN: ReadonlySet<Proposal['state']> = new Set([
  'open',
  'accepted',
]);

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
  const awaiting = useRef(new Set<number>());
  const proposalOf = (moment: Extract<ChatMoment, { kind: 'proposed' }>) => (
    <ChatProposal
      slug={slug}
      teamId={teamId}
      chatId={chat.id}
      position={moment.message.position}
      proposal={moment.proposal}
      attachments={moment.message.attachments}
      awaiting={awaiting}
    />
  );
  const pullRequestOf = (moment: Extract<ChatMoment, { kind: 'opened' }>) => (
    <ChatPullRequest
      slug={slug}
      teamId={teamId}
      chatId={chat.id}
      title={moment.message.body}
      pullRequest={moment.pullRequest}
    />
  );
  const tray = useDecisionTray(
    moments.flatMap((moment): DockedDecision[] => {
      if (moment.kind === 'proposed' && STILL_OPEN.has(moment.proposal.state)) {
        return [
          {
            id: moment.key,
            kind: 'Task proposal',
            label: moment.proposal.title,
            group: 'Tasks proposed',
            content: proposalOf(moment),
          },
        ];
      }
      if (moment.kind === 'opened' && moment.pullRequest.state === 'held') {
        return [
          {
            id: moment.key,
            kind: 'Pull request on hold',
            label: moment.message.body,
            group: 'Pull requests on hold',
            content: pullRequestOf(moment),
          },
        ];
      }
      return [];
    }),
  );
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
    <DecisionTrayContext value={tray}>
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
              const runs = dockedRuns(
                tray,
                turn.moments.map((moment) => moment.key),
              );

              return (
                <Turn
                  key={
                    turn.message
                      ? `message:${turn.message.position}`
                      : 'opening'
                  }
                  ref={sight(runsOfTurn(turn))}
                  className={cn(at > 0 && 'mt-6')}
                  shownFirst={at >= turns.length - TURNS_SHOWN_FIRST}
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
                      {turn.moments.map((moment, place) =>
                        runs.get(moment.key) === 0 ? null : (
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
                              <Dockable
                                id={moment.key}
                                run={runs.get(moment.key)}
                              >
                                {proposalOf(moment)}
                              </Dockable>
                            )}

                            {moment.kind === 'opened' && (
                              <Dockable
                                id={moment.key}
                                run={runs.get(moment.key)}
                              >
                                {pullRequestOf(moment)}
                              </Dockable>
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
                        ),
                      )}

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

            <DecisionTraySpace />
          </div>

          <div className="sticky bottom-0 z-20">
            <ComposerFooter floating>
              <DecisionTray tray={tray}>{footer}</DecisionTray>
            </ComposerFooter>
          </div>
        </div>
      </ScrollArea>
    </DecisionTrayContext>
  );
}
