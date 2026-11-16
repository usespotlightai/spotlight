import { ExpandableText } from '@/components/features/inbox/conversation/ExpandableText';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { Attachment } from '@/lib/attachment';

type BriefingCardProps = {
  briefing: string;
  attachments: readonly Attachment[];
};

export function BriefingCard({ briefing, attachments }: BriefingCardProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <MessageCard>
        <ExpandableText what="prompt">
          <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
            {briefing}
          </p>
        </ExpandableText>
      </MessageCard>

      <AttachmentTiles attachments={attachments} />
    </div>
  );
}
