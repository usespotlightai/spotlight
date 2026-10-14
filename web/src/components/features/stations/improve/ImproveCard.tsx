import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { ImproveCardSkeleton } from '@/components/features/stations/improve/ImproveCardSkeleton';

type ImproveCardProps = {
  title: string;
  description: string;
  loading: boolean;
  loadingLabel: string;
  id?: string;
  footer?: boolean;
  children: ReactNode;
};

export function ImproveCard({
  title,
  description,
  loading,
  loadingLabel,
  id,
  footer = false,
  children,
}: ImproveCardProps) {
  if (loading) {
    return (
      <ImproveCardSkeleton label={loadingLabel} rows={2} footer={footer} />
    );
  }

  return (
    <InsightsCard id={id} tableOnly title={title} description={description}>
      {children}
    </InsightsCard>
  );
}
