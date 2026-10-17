import type { ReactNode } from 'react';
import {
  Conversation,
  type Deciding,
} from '@/components/features/inbox/conversation/Conversation';
import { BriefingCard } from '@/components/features/runs/BriefingCard';
import type { RunJournal } from '@/lib/inbox';
import {
  type RunConversation as ConversationData,
  conversingOf,
} from '@/lib/run-conversation';

type RunConversationProps = {
  teamId: string;
  conversation: ConversationData;
  worked: readonly RunJournal[];
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
  footer,
  deciding,
  live,
  closing,
  openAt,
  afterRun,
}: RunConversationProps) {
  return (
    <Conversation
      item={conversingOf(conversation, teamId)}
      worked={worked}
      openAt={openAt}
      briefing={
        conversation.briefing ? (
          <BriefingCard
            briefing={conversation.briefing}
            attachments={conversation.attachments}
          />
        ) : undefined
      }
      live={live}
      closing={closing}
      footer={footer}
      deciding={deciding}
      afterRun={afterRun}
    />
  );
}
