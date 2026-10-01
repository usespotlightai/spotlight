import { CircleAlert, LoaderCircle } from 'lucide-react';
import { AttachmentChip } from '@/components/shared/attachment/AttachmentChip';
import { ChipRemoveButton } from '@/components/shared/attachment/ChipRemoveButton';
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
        <ChipRemoveButton
          label={`Remove ${attachment.name}`}
          onRemove={onRemove}
        />
      }
      className={cn('w-48 max-w-none', failed && 'border-destructive/40')}
    />
  );
}
