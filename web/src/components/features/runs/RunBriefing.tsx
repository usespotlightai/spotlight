import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { Attachment } from '@/lib/attachment';
import { cn } from '@/lib/utils';

type RunBriefingProps = {
  briefing: string;
  attachments: readonly Attachment[];
};

export function RunBriefing({ briefing, attachments }: RunBriefingProps) {
  const [open, setOpen] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);

  const toggle = () => {
    if (open && text.current) {
      text.current.scrollTop = 0;
    }
    setOpen(!open);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <SaidCard>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={
            open ? 'Show less of the prompt' : 'Show the whole prompt'
          }
          className="group/briefing relative block w-full text-left outline-none"
        >
          <p
            ref={text}
            className={cn(
              'whitespace-pre-wrap text-foreground text-sm leading-6',
              'transition-[max-height] duration-200 ease-out motion-reduce:transition-none',
              open
                ? 'max-h-64 overflow-y-auto'
                : 'max-h-32 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]',
            )}
          >
            {briefing}
          </p>

          <ChevronDown
            className={cn(
              'absolute right-0 bottom-0 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/briefing:text-foreground',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </SaidCard>

      <AttachmentTiles attachments={attachments} />
    </div>
  );
}
