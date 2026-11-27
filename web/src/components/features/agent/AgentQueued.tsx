import { QueuedForOfflineHosts } from '@/components/features/runners/QueuedForOfflineHosts';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useRunners } from '@/hooks/api/useRunners';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { isAdmin } from '@/lib/role';
import { addHostPath, offlineHarnessOf } from '@/lib/runner';

type AgentQueuedProps = {
  slug: string;
  harness: string;
};

export function AgentQueued({ slug, harness }: AgentQueuedProps) {
  const { data: fleet } = useRunners(slug);
  const { data: workspace } = useWorkspace(slug);
  const offline = offlineHarnessOf(fleet, harness);

  if (offline) {
    return <QueuedForOfflineHosts slug={slug} offline={offline} />;
  }

  if (fleet?.readyToRun !== false) {
    return (
      <span className="text-muted-foreground">
        Queued. The agent starts when a runner is free.
      </span>
    );
  }

  return (
    <span className="min-w-0 text-muted-foreground">
      Queued. No host serves this workspace.{' '}
      {workspace && isAdmin(workspace.role) ? (
        <TrailLink
          to={addHostPath(slug)}
          className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Add a host
        </TrailLink>
      ) : (
        'Ask an admin to add one.'
      )}
    </span>
  );
}
