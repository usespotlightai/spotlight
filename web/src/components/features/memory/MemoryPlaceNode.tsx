import type { PlaceNode } from '@/lib/memory';
import { cn } from '@/lib/utils';

const DOTTED =
  'before:transition-opacity after:transition-opacity before:duration-150 after:duration-150 before:absolute before:left-[-15px] before:top-[-5px] before:border-muted-foreground/50 before:border-l before:border-dotted after:absolute after:top-4 after:left-[-15px] after:border-muted-foreground/50 after:border-t after:border-dotted group-data-clamped/row:before:hidden group-data-clamped/row:after:hidden';

type MemoryPlaceNodeProps = {
  node: PlaceNode;
  at: string;
  root?: boolean;
  last: boolean;
  open: boolean;
  folded: ReadonlySet<string>;
  onFold: (at: string) => void;
};

export function MemoryPlaceNode({
  node,
  at,
  root = false,
  last,
  open,
  folded,
  onFold,
}: MemoryPlaceNodeProps) {
  const branches = node.children.length > 0;
  const hidden = folded.has(at);

  return (
    <li
      className={cn(
        'relative min-w-0 group-data-clamped/row:contents',
        !root && cn(DOTTED, 'pt-1.5'),
        !root && (last ? 'before:h-[21px]' : 'before:bottom-0'),
        !root && (branches ? 'after:w-3.5' : 'after:w-8'),
        !root &&
          (open
            ? 'before:delay-150 after:delay-150'
            : 'before:opacity-0 after:opacity-0'),
      )}
    >
      <div
        className={cn(
          'relative flex h-5 min-w-0 items-center whitespace-nowrap group-data-clamped/row:contents',
          (branches || !root) && 'pl-5',
        )}
      >
        {branches && (
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-expanded={!hidden}
            aria-label={`${hidden ? 'Show' : 'Hide'} what is under ${node.label}`}
            onClick={() => onFold(at)}
            className={cn(
              'absolute top-1/2 left-0 flex size-[11px] -translate-y-1/2 items-center justify-center rounded-[2px] border border-muted-foreground/50 bg-card text-muted-foreground outline-none transition-[color,border-color,opacity] duration-150 hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 group-data-clamped/row:hidden',
              open
                ? '[transition-delay:0ms,0ms,150ms]'
                : 'pointer-events-none opacity-0',
            )}
          >
            <span aria-hidden className="h-px w-[5px] bg-current" />
            {hidden && (
              <span aria-hidden className="absolute h-[5px] w-px bg-current" />
            )}
          </button>
        )}
        {node.joinedBy && (
          <span
            aria-hidden
            className="absolute whitespace-pre opacity-0 transition-opacity duration-200 group-data-clamped/row:static group-data-clamped/row:px-1 group-data-clamped/row:opacity-100"
          >
            {node.joinedBy}
          </span>
        )}
        <span
          data-glide-part
          className="min-w-0 truncate group-data-clamped/row:shrink-0 group-data-clamped/row:overflow-visible"
        >
          {node.label}
        </span>
      </div>

      {branches && (
        <ul
          className={cn(
            'relative pl-5 group-data-clamped/row:contents',
            hidden && 'hidden',
          )}
        >
          {node.children.map((child, index) => (
            <MemoryPlaceNode
              key={`${child.kind}-${child.label}`}
              node={child}
              at={`${at}/${child.label}`}
              last={index === node.children.length - 1}
              open={open}
              folded={folded}
              onFold={onFold}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
