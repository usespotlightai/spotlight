import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import { AttachmentChip } from '@/components/shared/attachment/AttachmentChip';
import { Button } from '@/components/ui/button';
import { type PendingAttachment, sized } from '@/lib/attachment';
import { cn } from '@/lib/utils';

type PendingAttachmentChipProps = {
  attachment: PendingAttachment;
  onRemove: () => void;
};

export function PendingAttachmentChip({
  attachment,
  onRemove,
}: PendingAttachmentChipProps) {
  const failed = attachment.state === 'failed';

  const lead =
    attachment.state === 'uploading' ? (
      <LoaderCircle className="size-4 animate-spin" aria-label="Uploading" />
    ) : failed ? (
      <CircleAlert className="size-4 text-destructive" aria-hidden />
    ) : attachment.preview ? (
      <img src={attachment.preview} alt="" className="size-full object-cover" />
    ) : undefined;

  return (
    <AttachmentChip
      name={attachment.name}
      lead={lead}
      detail={
        failed ? (
          <span className="text-destructive">{attachment.problem}</span>
        ) : (
          sized(attachment.size)
        )
      }
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mr-1 rounded-full text-muted-foreground"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
        >
          <X />
        </Button>
      }
      className={cn(failed && 'border-destructive/40')}
    />
  );
}
