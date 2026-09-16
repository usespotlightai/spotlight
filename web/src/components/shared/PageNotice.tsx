import type { ReactNode } from 'react';
import { Notice } from '@/components/shared/Notice';
import { PageHeader } from '@/components/shell/layout/PageHeader';

type PageNoticeProps = {
  title?: ReactNode;
  children: ReactNode;
};

export function PageNotice({ title, children }: PageNoticeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={title} />

      <Notice>{children}</Notice>
    </div>
  );
}
