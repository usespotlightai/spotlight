import { Inbox } from 'lucide-react';
import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { TeamNav } from '@/components/shell/layout/TeamNav';
import { WorkspaceMenu } from '@/components/shell/layout/WorkspaceMenu';
import { useInbox } from '@/hooks/api/useInbox';
import { useRunners } from '@/hooks/api/useRunners';
import { inboxPath } from '@/lib/inbox';
import { noneAnswering } from '@/lib/runner';
import type { Team } from '@/lib/team';

type WorkspaceSidebarProps = {
  slug: string;
  workspace: {
    readonly id: string;
    readonly name: string;
    readonly teams: readonly Team[];
  };
};

export function WorkspaceSidebar({ slug, workspace }: WorkspaceSidebarProps) {
  const { data: fleet } = useRunners(slug);
  const { data: waiting } = useInbox(slug);
  const unseen = waiting?.filter((each) => each.unread) ?? [];

  return (
    <>
      <div className="flex h-12 shrink-0 items-center">
        <WorkspaceMenu
          name={workspace.name}
          slug={slug}
          noneAnswering={Boolean(fleet && noneAnswering(fleet))}
        />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2">
        <SidebarLink
          to={inboxPath(slug)}
          icon={Inbox}
          trailing={
            unseen.length > 0 ? (
              <p className="text-xs">{unseen.length}</p>
            ) : null
          }
        >
          Inbox
        </SidebarLink>

        <TeamNav slug={slug} teams={workspace.teams} />
      </nav>
    </>
  );
}
