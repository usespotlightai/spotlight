import { ChartNoAxesColumn } from 'lucide-react';
import type { ReactNode } from 'react';

import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { EmptyFrame } from '@/components/shared/EmptyFrame';
import { EmptyState } from '@/components/shared/EmptyState';

type NoRunsInPeriodProps = {
  slug: string;
  teamId: string;
  children: ReactNode;
};

export function NoRunsInPeriod({
  slug,
  teamId,
  children,
}: NoRunsInPeriodProps) {
  return (
    <EmptyFrame>
      <EmptyState
        icon={ChartNoAxesColumn}
        title="No runs in this period"
        action={<CreateTaskLink slug={slug} teamId={teamId} />}
      >
        {children}
      </EmptyState>
    </EmptyFrame>
  );
}
