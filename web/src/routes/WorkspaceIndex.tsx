import type { ReactElement } from 'react';
import { Navigate, useParams } from 'react-router';

import { inboxPath } from '@/lib/inbox';

export function WorkspaceIndex(): ReactElement | null {
  const { slug } = useParams();

  if (slug === undefined || slug === '') {
    return null;
  }

  return <Navigate to={inboxPath(slug)} replace />;
}
