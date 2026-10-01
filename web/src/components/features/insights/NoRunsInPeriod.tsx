import { ChartNoAxesColumn } from 'lucide-react';
import type { ReactNode } from 'react';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
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
    <div className="flex justify-center rounded-xl border border-border px-4 py-10">
      <EmptyState
        icon={ChartNoAxesColumn}
        title="No runs in this period"
        action={<CreateTaskLink slug={slug} teamId={teamId} />}
      >
        {children}
      </EmptyState>
    </div>
  );
}
