import { ChartNoAxesColumn } from 'lucide-react';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import type { InsightsPeriod } from '@/lib/insights';
import { rangeOf } from '@/lib/range';

type NoRunsProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  children: string;
};

export function NoRuns({ slug, teamId, period, children }: NoRunsProps) {
  return (
    <Notice>
      <EmptyState
        icon={ChartNoAxesColumn}
        title="No runs"
        action={<CreateTaskLink slug={slug} teamId={teamId} />}
      >
        {`No runs in the ${rangeOf(period).label.toLowerCase()}. ${children}`}
      </EmptyState>
    </Notice>
  );
}
