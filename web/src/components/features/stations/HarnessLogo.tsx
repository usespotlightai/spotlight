import { Box } from 'lucide-react';
import { siClaude, siCursor } from 'simple-icons';
import { cn } from '@/lib/utils';

interface Mark {
  readonly path: string;
  readonly fill: string;
}

const marks: Record<string, Mark> = {
  'claude-code': { path: siClaude.path, fill: `#${siClaude.hex}` },
  cursor: { path: siCursor.path, fill: 'currentColor' },
};

type HarnessLogoProps = {
  harness: string | undefined;
  className?: string;
};

export function HarnessLogo({ harness, className }: HarnessLogoProps) {
  const mark = harness ? marks[harness] : undefined;

  if (!mark) {
    return (
      <Box
        className={cn('size-3.5 shrink-0 text-muted-foreground', className)}
        aria-hidden
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-3.5 shrink-0 text-foreground', className)}
      fill={mark.fill}
      aria-hidden
      data-harness={harness}
    >
      <path d={mark.path} />
    </svg>
  );
}
