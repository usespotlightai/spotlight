import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageNotice } from '@/components/shared/PageNotice';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

type NotFoundProps = {
  title: string;
  to: string;
  children: ReactNode;
};

export function NotFound({ title, to, children }: NotFoundProps) {
  return (
    <PageNotice title={title}>
      <div className="flex flex-col items-center gap-3">
        <p className="text-muted-foreground text-sm">{children}</p>

        <Link
          to={to}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'rounded-full bg-card',
          )}
        >
          Open the team
        </Link>
      </div>
    </PageNotice>
  );
}
