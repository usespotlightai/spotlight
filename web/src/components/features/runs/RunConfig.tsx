import { Settings2 } from 'lucide-react';
import { ConfigChanges } from '@/components/features/stations/ConfigChanges';
import { Fingerprint } from '@/components/shared/Fingerprint';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useRunConfig } from '@/hooks/api/useRunConfig';
import { loading } from '@/lib/query';
import { runPath } from '@/lib/run';

type RunConfigProps = {
  slug: string;
  teamId: string;
  runId: string;
};

const LINE = 'flex min-w-0 items-center gap-1.5 text-xs';
const ICON = (
  <Settings2 aria-hidden className="size-3.5 text-muted-foreground" />
);

export function RunConfig({ slug, teamId, runId }: RunConfigProps) {
  const query = useRunConfig(teamId, runId);

  if (loading(query)) {
    return (
      <p role="status" aria-label="Loading the run’s config" className={LINE}>
        {ICON}
        <span className="font-medium text-foreground">Config</span>
        <SkeletonLine className="w-14" />
      </p>
    );
  }

  const fingerprint = query.data?.fingerprint;

  if (!fingerprint) {
    return null;
  }

  const since = query.data?.changedSince;

  return (
    <div data-slot="run-config" className="flex flex-col gap-1">
      <p className={LINE}>
        {ICON}
        <span className="font-medium text-foreground">Config</span>
        <Fingerprint
          fingerprint={fingerprint}
          className="text-muted-foreground"
        />
        {since && (
          <span className="min-w-0 truncate text-muted-foreground">
            · Changed since{' '}
            <TrailLink
              to={runPath(slug, teamId, since.runId)}
              className="text-foreground underline-offset-2 hover:underline"
            >
              the station’s previous run
            </TrailLink>
          </span>
        )}
      </p>

      {since && <ConfigChanges changes={since.changes} className="pl-5" />}
    </div>
  );
}
