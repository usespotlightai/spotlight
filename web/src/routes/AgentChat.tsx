import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ChatComposer } from '@/components/features/agent/ChatComposer';
import { ChatThread } from '@/components/features/agent/ChatThread';
import { ProposalDetail } from '@/components/features/agent/ProposalDetail';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useChat } from '@/hooks/api/useChat';
import { useChatJournal } from '@/hooks/api/useChatJournal';
import { chatKeys } from '@/hooks/api/useChats';
import { useRunStream } from '@/hooks/api/useRunStream';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useLingering } from '@/hooks/useLingering';
import { newlyProposed } from '@/lib/chat';
import { teamPath, teamSectionPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

const LEAVING = 240;

export function AgentChat() {
  const { slug, teamId, chatId } = useParams();
  const { data: chat, isError } = useChat(teamId, chatId);
  const { data: journals } = useChatJournal(teamId, chatId);
  const { data: workspace } = useWorkspace(slug);
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState<{
    chatId: string;
    position: number;
  } | null>(null);

  const openAt = chatId && opened?.chatId === chatId ? opened.position : null;
  const heldAt = useLingering(openAt, LEAVING);
  const shown =
    heldAt === null ? null : (chat?.messages[heldAt]?.proposal ?? null);

  const toggle = (position: number) =>
    setOpened(openAt === position || !chatId ? null : { chatId, position });

  const seen = useRef<{ chatId: string; count: number } | null>(null);

  useEffect(() => {
    if (!chat) {
      return;
    }

    const was = seen.current;
    seen.current = { chatId: chat.id, count: chat.messages.length };

    if (was?.chatId !== chat.id) {
      return;
    }

    const position = newlyProposed(chat.messages, was.count);

    if (position !== null) {
      setOpened({ chatId: chat.id, position });
    }
  }, [chat]);

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.journal(chatId) });
    void queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
  }, [queryClient, chatId]);

  useRunStream(chat?.runId ?? undefined, Boolean(chat?.working), bump);

  const working = chat?.working;
  const said = chat?.messages.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a run settling or a new message is what the journal has to catch up with, though the effect reads neither
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.journal(chatId) });
  }, [queryClient, chatId, working, said]);

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team && slug
      ? [{ label: team.name, avatar: team.name, to: teamPath(slug, team.id) }]
      : []),
    ...(slug && teamId
      ? [{ label: 'Agent', to: teamSectionPath(slug, teamId, 'agent') }]
      : []),
    { label: chat?.title ?? 'Chat' },
  ];
  const { trail, forward } = useTrail(base);

  if (!slug || !teamId) {
    return null;
  }

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        {isError ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            <p className="text-muted-foreground text-sm">
              There is no such chat for this team.
            </p>
          </div>
        ) : (
          chat && (
            <ChatThread
              chat={chat}
              journals={journals ?? []}
              openAt={openAt}
              onOpen={toggle}
              footer={
                <ComposerFooter>
                  <ChatComposer slug={slug} teamId={teamId} chat={chat} />
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
                    onClose={() => setOpened(null)}
                  />
                )
              }
            />
          )
        )}
      </div>
    </TrailContext>
  );
}
