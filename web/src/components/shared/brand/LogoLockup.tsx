import { Logo } from '@/components/shared/icons';
import { cn } from '@/lib/utils';

export function LogoLockup({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Logo className="size-8 shrink-0" />
      <span className="font-medium text-[1.75rem] text-foreground leading-none tracking-tight">
        Spotlight
      </span>
    </span>
  );
}
