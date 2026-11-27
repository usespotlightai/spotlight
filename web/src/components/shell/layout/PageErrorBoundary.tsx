import { ErrorBoundary } from '@sentry/react';
import { type ReactNode, useState } from 'react';
import { useLocation } from 'react-router';

import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { cn } from '@/lib/utils';

type PageErrorBoundaryProps = {
  what?: string;
  centered?: boolean;
  children: ReactNode;
};

export function PageErrorBoundary({
  what = 'This page',
  centered = false,
  children,
}: PageErrorBoundaryProps) {
  const { pathname } = useLocation();
  const [failedAt, setFailedAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  if (failedAt !== null && failedAt !== pathname) {
    setFailedAt(null);
    setAttempt(attempt + 1);
  }

  return (
    <ErrorBoundary
      key={attempt}
      onError={() => setFailedAt(pathname)}
      onReset={() => setFailedAt(null)}
      fallback={(fallback) => (
        <CouldNotLoad
          what={what}
          retrying={false}
          onRetry={() => fallback.resetError()}
          className={cn('py-16', centered && 'min-w-0 flex-1')}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
