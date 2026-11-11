import { ErrorBoundary } from '@sentry/react';
import { type ReactNode, useEffect, useRef } from 'react';
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
  const boundary = useRef<ErrorBoundary>(null);

  useEffect(() => {
    if (pathname && boundary.current?.state.error) {
      boundary.current.resetErrorBoundary();
    }
  }, [pathname]);

  return (
    <ErrorBoundary
      ref={boundary}
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
