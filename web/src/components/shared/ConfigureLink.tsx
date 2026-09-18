import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfigureLinkProps = {
  href: string;
  name: string;
  className?: string;
};

export function ConfigureLink({ href, name, className }: ConfigureLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Configure ${name} on GitHub`}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'rounded-full bg-card shadow-none',
        className,
      )}
    >
      Configure
    </a>
  );
}
