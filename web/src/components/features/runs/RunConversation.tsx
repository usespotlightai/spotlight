import type { ReactNode } from 'react';
import {
  Conversation,
  type Deciding,
} from '@/components/features/inbox/conversation/Conversation';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import type { RunJournal } from '@/lib/inbox';
import {
  conversingOf,
  type RunConversation as Said,
} from '@/lib/run-conversation';

type RunConversationProps = {
  teamId: string;
  said: Said;
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
  said,
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
      item={conversingOf(said, teamId)}
      worked={worked}
      openAt={openAt}
      opening={
        said.briefing ? (
          <RunBriefing
            briefing={said.briefing}
            attachments={said.attachments}
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
