import { useEffect, useRef, useState } from 'react';
import { PendingAttachmentChip } from '@/components/shared/attachment/PendingAttachmentChip';
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
}: PendingAttachmentsProps) {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  if (attachments.length === 0) {
    return null;
  }

  const closing = attachments.every((each) => leaving.has(each.key));

  const leave = (key: string) => {
    if (timers.current.has(key)) {
      return;
    }

    setLeaving((was) => new Set(was).add(key));

    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        setLeaving((was) => {
          const next = new Set(was);
          next.delete(key);
          return next;
        });
        onRemove(key);
      }, LEAVING_MS),
    );
  };

  return (
    <div
      className={cn(
        'overflow-hidden motion-reduce:animate-none',
        closing ? 'animate-attachments-out' : 'animate-attachments-in',
      )}
    >
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
    </div>
  );
}
