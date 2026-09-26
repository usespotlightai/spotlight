import { SharedTraces } from '@/components/features/agent/SharedTraces';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { ChatMessage } from '@/lib/chat';

type ChatSaidProps = {
  slug: string;
  teamId: string;
  message: ChatMessage;
};

export function ChatSaid({ slug, teamId, message }: ChatSaidProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <SaidCard>
        <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
          {message.body}
        </p>
      </SaidCard>

      <AttachmentTiles attachments={message.attachments} />

      <SharedTraces slug={slug} teamId={teamId} traces={message.traces} />
    </div>
  );
}
