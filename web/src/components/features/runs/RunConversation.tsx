import type { ReactNode } from 'react';
import {
  Conversation,
  type Deciding,
} from '@/components/features/inbox/conversation/Conversation';
import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import type { RunJournal } from '@/lib/inbox';
import type { Work } from '@/lib/run';
import {
  type RunNotes as ConversationData,
  conversationItemOf,
} from '@/lib/run-notes';

type RunConversationProps = {
  teamId: string;
  conversation: ConversationData;
  worked: readonly RunJournal[];
  work: Work | null;
  footer: ReactNode;
  deciding?: Deciding;
  live?: ReactNode;
  closing?: ReactNode;
  openAt?: number | null;
  afterRun?: (runId: string) => ReactNode;
};

export function RunConversation({
  teamId,
  conversation,
  worked,
  work,
  footer,
  deciding,
  live,
  closing,
  openAt,
  afterRun,
}: RunConversationProps) {
  return (
    <Conversation
      item={conversationItemOf(conversation, teamId, work)}
      worked={worked}
      openAt={openAt}
      briefing={
        <InboxAsked
          station={conversation.station}
          title={conversation.title}
          description={conversation.description}
          attachments={conversation.attachments}
        />
      }
      live={live}
      closing={closing}
      footer={footer}
      deciding={deciding}
      afterRun={afterRun}
    />
  );
}
