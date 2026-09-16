import type { ReactNode } from 'react';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

type IntegrationCardSkeletonProps = {
  logo: ReactNode;
  name: ReactNode;
  children?: ReactNode;
};

export function IntegrationCardSkeleton({
  logo,
  name,
  children,
}: IntegrationCardSkeletonProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-2.5">
          {logo}

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {name}
            <SkeletonLine className="w-40 text-xs leading-5" />
          </div>

          {children}
        </div>

        <div className="mt-auto flex h-7 items-center justify-end" />
      </div>
    </article>
  );
}
