import {
  Activity,
  ChevronRight,
  FileText,
  ListTodo,
  MessageSquare,
  Package,
  Play,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { took } from '@/lib/inbox';
import { laidOut, type Row, type Trace, type TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

/** Bars any thinner than this cannot be read, and cannot be hit either. */
const LEAST_WIDTH = 0.4;

const INDENT = 14;

const icons: Record<string, ComponentType<{ className?: string }>> = {
  execute: Terminal,
  read: FileText,
  edit: FileText,
};

const iconFor = (node: TraceNode): ComponentType<{ className?: string }> => {
  if (node.kind === 'run') {
    return Play;
  }
  if (node.kind === 'phase') {
    return Package;
  }
  if (node.span && !node.step) {
    return Activity;
  }

  switch (node.step?.kind) {
    case 'said':
      return MessageSquare;
    case 'thought':
      return Sparkles;
    case 'planned':
      return ListTodo;
    case 'hook':
      return Package;
    default:
      return icons[node.step?.tool ?? ''] ?? Terminal;
  }
};

const fills: Record<string, string> = {
  agent: 'bg-primary',
  overhead: 'bg-faint',
  failed: 'bg-destructive',
};

type TraceRowProps = {
  row: Row;
  trace: Trace;
  picked: boolean;
  open: boolean;
  onPick: () => void;
  onToggle: () => void;
};

/**
 * One line of the waterfall: what it was on the left, and when it was on the
 * right, both on the trace's own scale so a slow step is one a reader sees
 * before they read anything.
 */
export function TraceRow({
  row,
  trace,
  picked,
  open,
  onPick,
  onToggle,
}: TraceRowProps) {
  const { node, depth, children } = row;
  const { left, width } = laidOut(node, trace);
  const Icon = iconFor(node);

  return (
    <li
      className={cn(
        'group relative flex h-7 items-center text-sm',
        picked ? 'bg-selected' : 'hover:bg-accent',
      )}
    >
      <div
        className="flex min-w-0 shrink-0 items-center gap-1 pr-3"
        style={{ width: 320, paddingLeft: depth * INDENT + 8 }}
      >
        {children > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? `Fold ${node.name}` : `Unfold ${node.name}`}
            className="relative z-10 flex shrink-0 items-center gap-0.5 rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn(
                'size-3 transition-transform duration-200',
                open && 'rotate-90',
              )}
            />
            {!open && (
              <span className="text-[10px] tabular-nums">{children}</span>
            )}
          </button>
        ) : (
          <span className="size-3 shrink-0" aria-hidden />
        )}

        <Icon
          className={cn(
            'size-3.5 shrink-0',
            node.tone === 'failed'
              ? 'text-destructive'
              : 'text-muted-foreground',
          )}
        />

        <button
          type="button"
          onClick={onPick}
          className={cn(
            'min-w-0 truncate text-left outline-none after:absolute after:inset-0',
            node.tone === 'failed' ? 'text-destructive' : 'text-foreground',
          )}
        >
          {node.name}
        </button>
      </div>

      <div className="relative min-w-0 flex-1 pr-3">
        <div
          className={cn(
            'absolute h-2 rounded-[4px]',
            fills[node.tone] ?? 'bg-faint',
          )}
          style={{
            left: `${left}%`,
            width: `${Math.max(width, LEAST_WIDTH)}%`,
            top: -4,
          }}
        />
        <span
          className="absolute whitespace-nowrap text-muted-foreground text-xs tabular-nums"
          style={{
            left: `min(${left + width}%, calc(100% - 3.5rem))`,
            top: -9,
          }}
        >
          <span className="pl-1.5">{took(node.to - node.from)}</span>
        </span>
      </div>
    </li>
  );
}
