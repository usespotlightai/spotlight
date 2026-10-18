import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { Attachment } from '@/lib/attachment';

type PersonMessageProps = {
  body: string;
  attachments: readonly Attachment[];
};

export function PersonMessage({ body, attachments }: PersonMessageProps) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <AttachmentTiles attachments={attachments} />

      {body && (
        <div className="self-stretch">
          <MessageCard>
            <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
              {body}
            </p>
          </MessageCard>
        </div>
      )}
    </div>
  );
}
