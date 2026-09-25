import { type Host, standing } from '@/lib/runner';
import { cn } from '@/lib/utils';

const dotOf = (host: Host) => {
  if (!host.answering) {
    return 'bg-muted-foreground/40';
  }
  return host.running.length > 0 ? 'bg-emerald-500' : 'bg-emerald-500/60';
};

export function HostStanding({ host }: { host: Host }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full font-medium text-muted-foreground text-xs">
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', dotOf(host))}
      />
      {standing(host)}
    </span>
  );
}
