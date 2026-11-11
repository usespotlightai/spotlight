import { Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

export function IntegrationLogo({
  logo,
  name,
  className,
}: {
  logo: string | null;
  name: string;
  className?: string;
}) {
  if (!logo) {
    return (
      <Webhook
        className={cn('size-5 shrink-0 text-muted-foreground', className)}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={logo}
      alt={name}
      referrerPolicy="no-referrer"
      draggable={false}
      className={cn('size-5 shrink-0 object-contain', className)}
    />
  );
}
