import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import type { JournalStep } from '@/lib/inbox';
import { cn } from '@/lib/utils';

// The action, as a past-tense word, the way the icon used to name it. It leads
// the row in a darker weight; the step's own text follows it, muted.
const verbFor = (step: JournalStep): string => {
  if (step.kind === 'thought') {
    return 'Thought';
  }
  if (step.kind === 'planned') {
    return 'Planned';
  }
  if (step.kind === 'hook') {
    return 'Ran';
  }

  switch (step.tool) {
    case 'read':
      return 'Read';
    case 'edit':
      return 'Edited';
    case 'write':
      return 'Wrote';
    case 'create':
      return 'Created';
    case 'execute':
      return 'Ran';
    case 'search':
      return 'Searched';
    case 'grep':
      return 'Grepped';
    case 'web':
    case 'fetch':
      return 'Fetched';
    case 'mcp':
      return 'Called';
    default:
      return 'Used';
  }
};

export function InboxStep({
  step,
  live = false,
}: {
  step: JournalStep;
  /** Whether the run is still going. A settled run's steps never shimmer,
   *  even one left at 'pending' because its completion update never arrived. */
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (step.kind === 'said') {
    return (
      <li className="px-1 py-0.5">
        <MarkdownEditor
          readOnly
          initialValue={step.text}
          placeholder=""
          ariaLabel="What the agent said"
          className="border-none bg-transparent p-0"
        />
      </li>
    );
  }

  const failed = step.status === 'failed';
  const running =
    live && (step.status === 'running' || step.status === 'pending');

  const prose = step.kind === 'thought' || step.kind === 'planned';
  const terminal = step.kind === 'hook' || step.tool === 'execute';
  const detail = prose ? (step.text.split('\n')[0] ?? '') : step.text;
  const keyword = verbFor(step);
  const label = `${keyword} ${detail}`.trim();
  const body =
    step.kind === 'thought'
      ? step.text.length > detail.length
        ? step.text
        : null
      : step.detail;
  const expandable = Boolean(body);

  const head = (
    <>
      <span className={cn('min-w-0 flex-1 truncate', running && 'step-shine')}>
        {running ? (
          label
        ) : (
          <>
            <span
              className={cn(
                'font-medium',
                failed ? 'text-destructive' : 'text-foreground',
              )}
            >
              {keyword}
            </span>
            {detail && (
              <span
                className={
                  failed ? 'text-destructive/70' : 'text-muted-foreground'
                }
              >
                {' '}
                {detail}
              </span>
            )}
          </>
        )}
      </span>

      <span className="flex size-4 shrink-0 items-center justify-center">
        <ChevronRight
          className={cn(
            'size-3 text-muted-foreground opacity-70 transition-transform duration-200',
            open && 'rotate-90',
            !expandable && 'invisible',
          )}
        />
      </span>
    </>
  );

  const row =
    'flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs leading-6';

  return (
    <li>
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cn(
            row,
            'cursor-pointer outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
          )}
        >
          {head}
        </button>
      ) : (
        <div className={row}>{head}</div>
      )}

      {expandable && (
        <div
          inert={!open}
          className={cn(
            'grid transition-all duration-200 ease-out',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            {prose ? (
              <p className="mt-0.5 mb-1 ms-1 max-h-64 overflow-auto whitespace-pre-wrap text-muted-foreground text-xs leading-5">
                {body}
              </p>
            ) : (
              <CodeBlock
                command={terminal ? step.text : undefined}
                output={body ?? ''}
                className="mt-2 mb-1 ms-1"
              />
            )}
          </div>
        </div>
      )}
    </li>
  );
}
