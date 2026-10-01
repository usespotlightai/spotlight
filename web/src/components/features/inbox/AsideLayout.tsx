import type { ReactNode } from 'react';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';

type AsideLayoutProps = {
  trail: readonly BreadcrumbSegment[];
  children: ReactNode;
};

export function AsideLayout({ trail, children }: AsideLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
