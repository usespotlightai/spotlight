import { FileDiff, Footprints } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Citation } from '@/lib/judge';
import { cn } from '@/lib/utils';

type CitationChipProps = {
  kind: Citation['kind'];
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function CitationChip({
  kind,
  pressed,
  onClick,
  children,
}: CitationChipProps) {
  const Icon = kind === 'step' ? Footprints : FileDiff;

  return (
    <button
      type="button"
      data-slot="citation"
      data-kind={kind}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex max-w-64 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        pressed && 'bg-accent text-foreground',
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
