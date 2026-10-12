import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const FRAME_MS = 80;

const SETTLED = '⠿';

const stillPreferred = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

type TerminalSpinnerProps = {
  settled?: 'filled' | 'faded' | null;
  className?: string;
  'aria-hidden'?: boolean;
};

export function TerminalSpinner({
  settled = null,
  className,
  'aria-hidden': hidden = true,
}: TerminalSpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (settled || stillPreferred()) {
      return;
    }
    const ticking = window.setInterval(
      () => setFrame((at) => (at + 1) % FRAMES.length),
      FRAME_MS,
    );

    return () => window.clearInterval(ticking);
  }, [settled]);

  return (
    <span
      aria-hidden={hidden}
      className={cn(
        'inline-flex h-4 shrink-0 select-none items-center text-base leading-none',
        className,
        'w-auto',
        settled === 'faded' && 'text-faint',
      )}
    >
      {settled ? SETTLED : FRAMES[frame]}
    </span>
  );
}
