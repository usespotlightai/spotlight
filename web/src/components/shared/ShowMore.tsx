import type { ReactNode } from 'react';

import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Button } from '@/components/ui/button';
import type { PagedList } from '@/hooks/api/usePagedList';
import { failed, loading } from '@/lib/query';
import { cn } from '@/lib/utils';

type ShowMoreProps = {
  list: PagedList<unknown>;
  what: string;
  skeleton?: ReactNode;
  className?: string;
};

export function ShowMore({ list, what, skeleton, className }: ShowMoreProps) {
  if (loading(list)) {
    return skeleton ?? null;
  }

  if (failed(list)) {
    return (
      <CouldNotLoad
        what={what}
        retrying={list.isFetching}
        onRetry={() => void list.refetch()}
        className={cn('py-4', className)}
      />
    );
  }

  if (!list.more.available) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('self-center text-muted-foreground', className)}
      disabled={list.more.loading}
      onClick={list.more.load}
    >
      {list.more.loading ? 'Loading…' : 'Show more'}
    </Button>
  );
}
