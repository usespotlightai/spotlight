import { PendingAttachmentChip } from '@/components/shared/attachment/PendingAttachmentChip';
import type { PendingAttachment } from '@/lib/attachment';
import { cn } from '@/lib/utils';

type PendingAttachmentsProps = {
  attachments: readonly PendingAttachment[];
  onRemove: (key: string) => void;
  className?: string;
};

export function PendingAttachments({
  attachments,
  onRemove,
  className,
}: PendingAttachmentsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Attachments"
      className={cn('flex flex-wrap gap-2', className)}
    >
      {attachments.map((each) => (
        <li key={each.key} className="min-w-0">
          <PendingAttachmentChip
            attachment={each}
            onRemove={() => onRemove(each.key)}
          />
        </li>
      ))}
    </ul>
  );
}
