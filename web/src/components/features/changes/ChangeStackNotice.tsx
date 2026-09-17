import { CircleDashed, Layers, TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import type { ChangeStack } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

type ChangeStackNoticeProps = {
  stack: ChangeStack | null;
  runTo: string;
};

export function ChangeStackNotice({ stack, runTo }: ChangeStackNoticeProps) {
  const back = (
    <TrailLink
      to={runTo}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'rounded-full bg-card shadow-none',
      )}
    >
      Back to the run
    </TrailLink>
  );

  if (stack?.state === 'drafting') {
    const changes = stack.files.reduce(
      (total, file) => total + file.hunks.length,
      0,
    );

    return (
      <Notice>
        <EmptyState icon={CircleDashed} title="Drafting the change stack">
          Grouping {changes} {changes === 1 ? 'change' : 'changes'} across{' '}
          {stack.files.length} {stack.files.length === 1 ? 'file' : 'files'}{' '}
          into the order to review them in.
        </EmptyState>
      </Notice>
    );
  }

  if (stack?.state === 'failed') {
    return (
      <Notice>
        <EmptyState
          icon={TriangleAlert}
          title="The change stack could not be drafted"
          action={back}
        >
          {stack.failure ?? 'Drafting stopped before it finished.'}
        </EmptyState>
      </Notice>
    );
  }

  return (
    <Notice>
      <EmptyState icon={Layers} title="No change stack yet" action={back}>
        One appears here once a station with the change-stack tool finishes its
        work.
      </EmptyState>
    </Notice>
  );
}
