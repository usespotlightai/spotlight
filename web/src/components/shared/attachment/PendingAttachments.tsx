import type { ReactElement } from 'react';

import { ImageGallery } from '@/components/shared/attachment/ImageGallery';
import { PendingAttachmentChip } from '@/components/shared/attachment/PendingAttachmentChip';
import { useLeaving } from '@/hooks/useLeaving';
import type { PendingAttachment } from '@/lib/attachment';
import { cn } from '@/lib/utils';

const LEAVING_MS = 140;

type PendingAttachmentsProps = {
  attachments: readonly PendingAttachment[];
  onRemove: (key: string) => void;
  className?: string;
};

export function PendingAttachments({
  attachments,
  onRemove,
  className,
}: PendingAttachmentsProps): ReactElement | null {
  const { leaving, leave } = useLeaving(LEAVING_MS, onRemove);

  if (attachments.length === 0) {
    return null;
  }

  const closing = attachments.every((each) => leaving.has(each.key));

  return (
    <div
      className={cn(
        'overflow-hidden motion-reduce:animate-none',
        closing ? 'animate-attachments-out' : 'animate-attachments-in',
      )}
    >
      <ImageGallery>
        <ul
          aria-label="Attachments"
          className={cn('flex flex-wrap gap-y-2', className)}
        >
          {attachments.map((each) => (
            <li
              key={each.key}
              className={cn(
                'mr-2 w-48 shrink-0 overflow-hidden motion-reduce:animate-none',
                leaving.has(each.key)
                  ? 'animate-attachment-out'
                  : 'animate-attachment-in',
              )}
            >
              <PendingAttachmentChip
                attachment={each}
                onRemove={() => leave(each.key)}
              />
            </li>
          ))}
        </ul>
      </ImageGallery>
    </div>
  );
}
