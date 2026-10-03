import { Plus } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import { addHostPath } from '@/lib/runner';
import { cn } from '@/lib/utils';

type AddHostLinkProps = {
  slug: string;
  label?: string;
};

export function AddHostLink({ slug, label = 'Add a host' }: AddHostLinkProps) {
  return (
    <TrailLink
      to={addHostPath(slug)}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'rounded-full bg-card shadow-none',
      )}
    >
      <Plus aria-hidden className="size-3.5" />
      {label}
    </TrailLink>
  );
}
