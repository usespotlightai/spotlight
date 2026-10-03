import type { ReactNode } from 'react';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import type { RunJournal } from '@/lib/inbox';
import type { TeamRun } from '@/lib/run';
import {
  conversingOf,
  type RunConversation as Said,
} from '@/lib/run-conversation';

type RunConversationProps = {
  teamId: string;
  run: TeamRun;
  said: Said;
  worked: readonly RunJournal[];
  activity: ReactNode;
  closing: ReactNode;
  footer: ReactNode;
};

export function RunConversation({
  teamId,
  run,
  said,
  worked,
  activity,
  closing,
  footer,
}: RunConversationProps) {
  return (
    <Conversation
      item={conversingOf(said, teamId)}
      worked={worked}
      opening={
        said.briefing ? (
          <RunBriefing
            briefing={said.briefing}
            attachments={said.attachments}
          />
        ) : undefined
      }
      live={run.state === 'claimed' ? activity : undefined}
      closing={closing}
      footer={footer}
    />
  );
}
