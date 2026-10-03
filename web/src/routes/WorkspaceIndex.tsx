import { Navigate, useParams } from 'react-router';
import { inboxPath } from '@/lib/inbox';

export function WorkspaceIndex() {
  const { slug } = useParams();

  if (!slug) {
    return null;
  }

  return <Navigate to={inboxPath(slug)} replace />;
}
