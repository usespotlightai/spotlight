import { Inbox, Server } from 'lucide-react';
import { SidebarLink } from '@/components/layout/SidebarLink';
import { TeamNav } from '@/components/layout/TeamNav';
import { WorkspaceMenu } from '@/components/layout/WorkspaceMenu';
import { useInbox } from '@/hooks/api/useInbox';
import { useRunners } from '@/hooks/api/useRunners';
import { inboxPath } from '@/lib/inbox';
import { reachableCount, runnersPath } from '@/lib/runner';
import type { Team } from '@/lib/team';

type WorkspaceSidebarProps = {
  workspace: {
    readonly name: string;
    readonly slug: string;
    readonly teams: readonly Team[];
  };
};

export function WorkspaceSidebar({ workspace }: WorkspaceSidebarProps) {
  const { data: runners } = useRunners();
  const { data: waiting } = useInbox(workspace.slug);

  return (
    <>
      <div className="flex h-12 shrink-0 items-center">
        <WorkspaceMenu name={workspace.name} slug={workspace.slug} />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2">
        <SidebarLink
          to={inboxPath(workspace.slug)}
          icon={Inbox}
          trailing={
            waiting && waiting.length > 0 ? (
              <p className="text-xs">{waiting.length}</p>
            ) : null
          }
        >
          Inbox
        </SidebarLink>

        <TeamNav slug={workspace.slug} teams={workspace.teams} />

        <SidebarLink
          to={runnersPath(workspace.slug)}
          icon={Server}
          trailing={
            <p className="text-xs">{runners && reachableCount(runners)}</p>
          }
        >
          Runners
        </SidebarLink>
      </nav>
    </>
  );
}
