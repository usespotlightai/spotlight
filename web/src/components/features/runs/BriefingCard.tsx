import { ChevronDown } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Attachment } from '@/lib/attachment';
import { cn } from '@/lib/utils';

type BriefingCardProps = {
  briefing: string;
  attachments: readonly Attachment[];
};

export function BriefingCard({ briefing, attachments }: BriefingCardProps) {
  const [open, setOpen] = useState(false);
  const text = useRef<HTMLDivElement>(null);
  const shown = useId();

  const toggle = () => {
    if (open && text.current) {
      text.current.scrollTop = 0;
    }
    setOpen(!open);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <MessageCard>
        <div className="group/briefing relative">
          <ScrollArea
            viewportRef={text}
            className={cn(
              'transition-[max-height] duration-200 ease-out motion-reduce:transition-none',
              open
                ? 'max-h-64'
                : 'max-h-32 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]',
            )}
          >
            <p
              id={shown}
              className="whitespace-pre-wrap text-foreground text-sm leading-6"
            >
              {briefing}
            </p>
          </ScrollArea>

          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={shown}
            aria-label={
              open ? 'Show less of the prompt' : 'Show the whole prompt'
            }
            className={cn(
              'absolute rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
              open ? 'right-0 bottom-0 size-3.5' : 'inset-0',
            )}
          >
            <ChevronDown
              className={cn(
                'absolute right-0 bottom-0 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/briefing:text-foreground',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </div>
      </MessageCard>

      <AttachmentTiles attachments={attachments} />
    </div>
  );
}
