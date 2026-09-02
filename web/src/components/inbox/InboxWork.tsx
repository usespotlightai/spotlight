import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ContextDonut } from '@/components/inbox/ContextDonut';
import { InboxStep } from '@/components/inbox/InboxStep';
import { counted, type RunJournal, took } from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function InboxWork({ journals }: { journals: readonly RunJournal[] }) {
  const [open, setOpen] = useState(false);

  const steps = journals.flatMap((each) => each.steps);
  const unreadable = journals.some((each) => !each.readable);

  if (steps.length === 0) {
    return unreadable ? (
      <p className="py-1.5 text-muted-foreground text-xs">
        This run left terminal output, from before the agents spoke a protocol.
      </p>
    ) : null;
  }

  const attempts = journals.length;
  // Summed, because a retried run is several journals for one message.
  const ms = journals.reduce((all, each) => all + (each.ms ?? 0), 0);
  const spent = journals.map((each) => each.spent).filter(Boolean)[0];

  return (
    <div className="py-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn(
            'size-3 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        <span>
          {ms > 0 ? `Worked for ${took(ms)}` : 'Worked'} · {steps.length}{' '}
          {steps.length === 1 ? 'step' : 'steps'}
          {attempts > 1 && ` over ${attempts} attempts`}
          {spent && ' ·'}
        </span>
        {spent && (
          <span
            className="flex items-center gap-1"
            title={`${counted(spent.used)} of ${counted(spent.size)} tokens held in context`}
          >
            <ContextDonut used={spent.used} size={spent.size} />
            {counted(spent.used)}/{counted(spent.size)}
          </span>
        )}
      </button>

      <div
        inert={!open}
        className={cn(
          'grid transition-all duration-200 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        {/* The grid item carries no padding of its own: a box of height zero
            with padding is not a box of height zero. */}
        <div className="min-h-0 overflow-hidden">
          <ol className="flex flex-col gap-2 border-border border-l pt-2 pl-3">
            {steps.map((step, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are appended and never reordered, so where one sits is what names it
              <InboxStep key={at} step={step} />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
