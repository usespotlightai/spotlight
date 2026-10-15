import { ErrorBoundary } from '@sentry/react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';

export function PageErrorBoundary({ children }: { children: ReactNode }) {
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
      fallback={({ resetError }) => (
        <CouldNotLoad
          what="This page"
          retrying={false}
          onRetry={resetError}
          className="py-16"
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
