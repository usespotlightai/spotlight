import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { isAdmin } from '@/lib/role';
import { offlineWordsOf, type QuietHosts } from '@/lib/run-waiting';
import { addHostPath } from '@/lib/runner';

type QueuedForOfflineHostsProps = {
  slug: string;
  quiet: QuietHosts;
  what: 'chat' | 'run';
};

const LINK =
  'rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

export function QueuedForOfflineHosts({
  slug,
  quiet,
  what,
}: QueuedForOfflineHostsProps) {
  const { data: workspace } = useWorkspace(slug);
  const admin = workspace ? isAdmin(workspace.role) : false;
  const none = quiet.hosts.length === 0;
  const which = quiet.hosts.length === 1 ? 'it' : 'one';

  return (
    <span className="min-w-0 text-muted-foreground">
      {offlineWordsOf(quiet, what)}{' '}
      {admin && none && (
        <TrailLink to={addHostPath(slug)} className={LINK}>
          Add a host
        </TrailLink>
      )}
      {admin && !none && (
        <>
          Start {which}, or{' '}
          <TrailLink to={addHostPath(slug)} className={LINK}>
            add another host
          </TrailLink>
          .
        </>
      )}
      {!admin &&
        (none ? 'Ask an admin to add one.' : `Ask an admin to start ${which}.`)}
    </span>
  );
}
