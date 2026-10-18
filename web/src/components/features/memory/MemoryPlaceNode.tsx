import { MemoryPlaceToggle } from '@/components/features/memory/MemoryPlaceToggle';
import type { PlaceNode } from '@/lib/memory';
import { cn } from '@/lib/utils';

const DOTTED =
  'before:transition-opacity after:transition-opacity before:duration-150 after:duration-150 before:absolute before:left-[-15px] before:top-[-5px] before:border-muted-foreground/50 before:border-l before:border-dotted after:absolute after:top-4 after:left-[-15px] after:border-muted-foreground/50 after:border-t after:border-dotted group-data-clamped/row:before:hidden group-data-clamped/row:after:hidden';

const connectorOf = (
  root: boolean,
  last: boolean,
  branches: boolean,
  open: boolean,
): string | false =>
  !root &&
  cn(
    DOTTED,
    'pt-1.5',
    last ? 'before:h-[21px]' : 'before:bottom-0',
    branches ? 'after:w-3.5' : 'after:w-8',
    open
      ? 'before:delay-150 after:delay-150'
      : 'before:opacity-0 after:opacity-0',
  );

type MemoryPlaceNodeProps = {
  node: PlaceNode;
  at: string;
  root?: boolean;
  last: boolean;
  open: boolean;
  collapsed: ReadonlySet<string>;
  onToggle: (at: string) => void;
};

export function MemoryPlaceNode({
  node,
  at,
  root = false,
  last,
  open,
  collapsed,
  onToggle,
}: MemoryPlaceNodeProps) {
  const branches = node.children.length > 0;
  const hidden = collapsed.has(at);

  return (
    <li
      className={cn(
        'relative min-w-0 group-data-clamped/row:contents',
        connectorOf(root, last, branches, open),
      )}
    >
      <div
        className={cn(
          'relative flex h-5 min-w-0 items-center whitespace-nowrap group-data-clamped/row:contents',
          (branches || !root) && 'pl-5',
        )}
      >
        {branches && (
          <MemoryPlaceToggle
            label={node.label}
            hidden={hidden}
            open={open}
            onToggle={() => onToggle(at)}
          />
        )}
        {node.joinedBy && (
          <span
            aria-hidden
            data-transition-part
            className="absolute whitespace-pre px-1 opacity-0 transition-opacity duration-200 group-data-closing/row:opacity-100 group-data-clamped/row:static group-data-clamped/row:opacity-100"
          >
            {node.joinedBy}
          </span>
        )}
        <span
          data-transition-part
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
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
