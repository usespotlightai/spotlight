import {
  ChevronRight,
  Eye,
  Globe,
  Hammer,
  ListTodo,
  type LucideIcon,
  MessageCircle,
  Search,
  SquarePen,
  Terminal,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import type { JournalStep } from '@/lib/inbox';
import { cn } from '@/lib/utils';

const glyphFor = (step: JournalStep): LucideIcon => {
  if (step.kind === 'thought') {
    return MessageCircle;
  }
  if (step.kind === 'planned') {
    return ListTodo;
  }
  if (step.kind === 'hook') {
    return Terminal;
  }

  switch (step.tool) {
    case 'read':
      return Eye;
    case 'edit':
    case 'write':
    case 'create':
      return SquarePen;
    case 'execute':
      return Terminal;
    case 'search':
    case 'grep':
      return Search;
    case 'web':
    case 'fetch':
      return Globe;
    case 'mcp':
      return Wrench;
    default:
      return Hammer;
  }
};

export function InboxStep({ step }: { step: JournalStep }) {
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

  const Glyph = glyphFor(step);
  const failed = step.status === 'failed';
  const running = step.status === 'running' || step.status === 'pending';

  const prose = step.kind === 'thought' || step.kind === 'planned';
  const label = prose ? (step.text.split('\n')[0] ?? '') : step.text;
  const body =
    step.kind === 'thought'
      ? step.text.length > label.length
        ? step.text
        : null
      : step.detail;
  const expandable = Boolean(body);

  const head = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center">
        <Glyph
          className={cn(
            'size-4 stroke-[1.8]',
            failed ? 'text-destructive' : 'text-muted-foreground',
          )}
        />
      </span>

      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          running
            ? 'step-shine'
            : failed
              ? 'text-destructive'
              : 'text-muted-foreground',
        )}
      >
        {label}
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
              <p className="mt-0.5 mb-1 ms-7 max-h-64 overflow-auto whitespace-pre-wrap text-muted-foreground text-xs leading-5">
                {body}
              </p>
            ) : (
              <pre className="mt-0.5 mb-1 ms-7 max-h-64 select-text overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 px-3 py-2 font-mono text-muted-foreground text-xs leading-5">
                {body}
              </pre>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
