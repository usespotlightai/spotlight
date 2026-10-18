import { Box } from 'lucide-react';
import { siClaude, siCursor, siGooglegemini, siOpencode } from 'simple-icons';
import { OPENAI_PATH } from '@/components/features/stations/openai-mark';
import { cn } from '@/lib/utils';

interface Mark {
  readonly path: string;
  readonly fill: string;
}

const marks: Record<string, Mark> = {
  'claude-code': { path: siClaude.path, fill: `#${siClaude.hex}` },
  cursor: { path: siCursor.path, fill: 'currentColor' },
  codex: { path: OPENAI_PATH, fill: 'currentColor' },
  opencode: { path: siOpencode.path, fill: 'currentColor' },
  gemini: { path: siGooglegemini.path, fill: `#${siGooglegemini.hex}` },
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
