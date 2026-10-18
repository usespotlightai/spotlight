import { cn } from '@/lib/utils';

export type Tone = 'busy' | 'ready' | 'gone';

const DOTS: Record<Tone, string> = {
  busy: 'bg-emerald-500',
  ready: 'bg-emerald-500/60',
  gone: 'bg-muted-foreground/40',
};

type StatusDotProps = {
  tone: Tone;
  children: string;
};

export function StatusDot({ tone, children }: StatusDotProps) {
  return (
    <span className="flex min-w-0 shrink-0 items-center gap-1.5 font-medium text-muted-foreground text-xs">
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', DOTS[tone])}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}
