import type { ReactNode } from 'react';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';

type InboxDetailLayoutProps = {
  trail: readonly BreadcrumbSegment[];
  children: ReactNode;
};

export function InboxDetailLayout({ trail, children }: InboxDetailLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
