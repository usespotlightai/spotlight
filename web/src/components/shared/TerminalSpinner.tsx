import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const FRAME_MS = 80;

const STOPPED = '⠿';

const stillPreferred = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

type TerminalSpinnerProps = {
  stopped?: 'filled' | 'faded' | null;
  className?: string;
  'aria-hidden'?: boolean;
};

export function TerminalSpinner({
  stopped = null,
  className,
  'aria-hidden': hidden = true,
}: TerminalSpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (stopped || stillPreferred()) {
      return;
    }
    const ticking = window.setInterval(
      () => setFrame((at) => (at + 1) % FRAMES.length),
      FRAME_MS,
    );

    return () => window.clearInterval(ticking);
  }, [stopped]);

  return (
    <span
      aria-hidden={hidden}
      className={cn(
        'inline-flex h-4 shrink-0 select-none items-center text-base leading-none',
        className,
        'w-auto',
        stopped === 'faded' && 'text-faint',
      )}
    >
      {stopped ? STOPPED : FRAMES[frame]}
    </span>
  );
}
