import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { Attachment } from '@/lib/attachment';

type PersonSaidProps = {
  body: string;
  attachments: readonly Attachment[];
  name?: string | null;
};

export function PersonSaid({ body, attachments, name }: PersonSaidProps) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {name && (
        <span className="font-medium text-muted-foreground text-xs">
          {name}
        </span>
      )}

      <AttachmentTiles attachments={attachments} />

      {body && (
        <SaidCard>
          <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
            {body}
          </p>
        </SaidCard>
      )}
    </div>
  );
}
