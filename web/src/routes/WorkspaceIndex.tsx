import { Navigate, useParams } from 'react-router';

import { inboxPath } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

export function WorkspaceIndex() {
  const { slug } = useParams();

  if (!nonEmpty(slug)) {
    return null;
  }

  return <Navigate to={inboxPath(slug)} replace />;
}
