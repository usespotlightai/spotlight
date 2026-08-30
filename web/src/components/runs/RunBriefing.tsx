import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { SaidCard } from '@/components/inbox/SaidCard';
import { cn } from '@/lib/utils';

/** What the run was given, word for word. It names its own station. */
export function RunBriefing({ briefing }: { briefing: string }) {
  const [open, setOpen] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);

  // Folding it away leaves whatever was scrolled to, which is not where it
  // begins: a prompt read from its middle says nothing.
  const toggle = () => {
    if (open && text.current) {
      text.current.scrollTop = 0;
    }
    setOpen(!open);
  };

  return (
    <SaidCard>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Show less of the prompt' : 'Show the whole prompt'}
        className="group/briefing relative block w-full text-left outline-none"
      >
        {/* Held at the top, the whole of it would cover the work it asked for.
            Cut short and faded until it is asked for, scrolled after: it never
            takes more of the view than this. */}
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
  );
}
