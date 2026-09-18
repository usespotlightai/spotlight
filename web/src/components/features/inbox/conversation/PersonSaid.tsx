import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { Attachment } from '@/lib/attachment';

type PersonSaidProps = {
  body: string;
  attachments: readonly Attachment[];
};

export function PersonSaid({ body, attachments }: PersonSaidProps) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <AttachmentTiles attachments={attachments} />

      {body && (
        <div className="self-stretch">
          <SaidCard>
            <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
              {body}
            </p>
          </SaidCard>
        </div>
      )}
    </div>
  );
}
