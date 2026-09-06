import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { type JournalStep, took } from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function InboxStep({ step }: { step: JournalStep }) {
  const [open, setOpen] = useState(false);

  if (step.kind !== 'tool') {
    return (
      <li className="flex flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">
          {step.kind === 'thought' ? 'Thought' : 'Said'}
          {step.ms >= 1_000 && ` ${took(step.ms)}`}
        </span>

        {step.kind === 'thought' ? (
          <p className="whitespace-pre-wrap text-muted-foreground text-sm italic leading-6">
            {step.text}
          </p>
        ) : (
          <MarkdownEditor
            readOnly
            initialValue={step.text}
            placeholder=""
            ariaLabel="What the agent said"
            className="border-none bg-transparent p-0"
          />
        )}
      </li>
    );
  }

  // A command is the one title that does not name its own tool, so it is the
  // one that needs saying what was done with it.
  const ran = step.tool === 'execute';
  const failed = step.status === 'failed';

  if (!step.detail) {
    return (
      <li className="text-sm leading-6">
        {ran && <span className="text-muted-foreground">Ran </span>}
        <span className={cn(failed ? 'text-destructive' : 'text-foreground')}>
          {step.text}
        </span>
        {step.ms >= 1_000 && (
          <span className="text-muted-foreground"> {took(step.ms)}</span>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 text-left text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn(
            'size-3 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        {ran && <span className="text-muted-foreground">Ran </span>}
        <span
          className={cn(
            'truncate',
            failed ? 'text-destructive' : 'text-foreground',
          )}
        >
          {step.text}
        </span>
        {step.ms >= 1_000 && (
          <span className="shrink-0 text-muted-foreground">
            {took(step.ms)}
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
        <div className="min-h-0 overflow-hidden">
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-muted-foreground text-xs leading-5">
            {step.detail}
          </pre>
        </div>
      </div>
    </li>
  );
}
