import { useEffect, useRef } from 'react';

import { canAnimate, prefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const FRAME_MS = 80;

const TEXT = '\uFE0E';

export type Stopped = 'waiting' | 'succeeded' | 'dismissed';

const SYMBOLS: Record<Stopped, { glyph: string; tone: string }> = {
  waiting: { glyph: '?', tone: 'text-primary' },
  succeeded: { glyph: `✓${TEXT}`, tone: 'text-muted-foreground' },
  dismissed: { glyph: `✕${TEXT}`, tone: 'text-faint' },
};

type TerminalSpinnerProps = {
  stopped?: Stopped | null;
  className?: string;
  'aria-hidden'?: boolean;
};

export function TerminalSpinner({
  stopped = null,
  className,
  'aria-hidden': hidden = true,
}: TerminalSpinnerProps) {
  const strip = useRef<HTMLSpanElement>(null);
  const moving = !stopped && !prefersReducedMotion();
  const glyphs = moving
    ? FRAMES
    : [stopped ? SYMBOLS[stopped].glyph : FRAMES[0]];

  useEffect(() => {
    if (!moving || !canAnimate(strip.current)) {
      return;
    }
    const turning = strip.current.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
      {
        duration: FRAME_MS * FRAMES.length,
        easing: `steps(${FRAMES.length})`,
        iterations: Infinity,
      },
    );

    return () => turning.cancel();
  }, [moving]);

  return (
    <span
      aria-hidden={hidden}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 select-none items-start justify-center overflow-hidden text-base leading-4',
        className,
        stopped && SYMBOLS[stopped].tone,
      )}
    >
      <span ref={strip} className="flex flex-col">
        {glyphs.map((glyph) => (
          <span key={glyph}>{glyph}</span>
        ))}
      </span>
    </span>
  );
}
