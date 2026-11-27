import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { isAdmin } from '@/lib/role';
import { addHostPath, type OfflineHarness, offlineWordsOf } from '@/lib/runner';

type QueuedForOfflineHostsProps = {
  slug: string;
  offline: OfflineHarness;
};

export function QueuedForOfflineHosts({
  slug,
  offline,
}: QueuedForOfflineHostsProps) {
  const { data: workspace } = useWorkspace(slug);
  const { data: harnesses } = useHarnesses();
  const name =
    harnesses?.find((each) => each.id === offline.harness)?.name ??
    offline.harness;
  const which = offline.hosts.length === 1 ? 'it' : 'one';

  return (
    <span className="min-w-0 text-muted-foreground">
      {offlineWordsOf(offline, name)}{' '}
      {workspace && isAdmin(workspace.role) ? (
        <>
          Start {which}, or{' '}
          <TrailLink
            to={addHostPath(slug)}
            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            add another host
          </TrailLink>
          .
        </>
      ) : (
        `Ask an admin to start ${which}.`
      )}
    </span>
  );
}
