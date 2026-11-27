import type { ReactElement } from 'react';
import { Navigate, useParams } from 'react-router';

import { inboxPath } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

export function WorkspaceIndex(): ReactElement | null {
  const { slug } = useParams();

  if (!nonEmpty(slug)) {
    return null;
  }

  return <Navigate to={inboxPath(slug)} replace />;
}
