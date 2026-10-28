import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { SkeletonBlock } from '@/components/shared/skeleton/SkeletonBlock';
import type { TooltipText } from '@/lib/tooltip-note';

type InsightsCardSkeletonProps = {
  label?: string;
  title: string;
  description?: TooltipText;
  actions?: ReactNode;
  switchable?: boolean;
  tableOnly?: boolean;
  level?: 2 | 3;
  className?: string;
  children: ReactNode;
};

export function InsightsCardSkeleton({
  label,
  switchable = false,
  children,
  ...card
}: InsightsCardSkeletonProps) {
  return (
    <SkeletonBlock label={label}>
      <InsightsCard {...card} table={switchable ? children : undefined}>
        {children}
      </InsightsCard>
    </SkeletonBlock>
  );
}
