import { LoaderCircle } from 'lucide-react';
import { Navigate } from 'react-router';
import { useRunners } from '@/hooks/api/useRunners';
import { connectedIn, runnersPath } from '@/lib/runner';

type HostConnectionProps = {
  slug: string;
  pool: string;
};

export function HostConnection({ slug, pool }: HostConnectionProps) {
  const { data: fleet } = useRunners(slug);

  if (connectedIn(fleet, pool)) {
    return <Navigate to={runnersPath(slug)} replace />;
  }

  return (
    <p
      role="status"
      className="flex items-center gap-1.5 text-muted-foreground text-xs"
    >
      <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
      Waiting for a host in the {pool} pool
    </p>
  );
}
