import { Inbox } from 'lucide-react';
import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { SidebarSearch } from '@/components/shell/layout/SidebarSearch';
import { TeamNav } from '@/components/shell/layout/TeamNav';
import { WorkspaceMenu } from '@/components/shell/layout/WorkspaceMenu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInbox } from '@/hooks/api/useInbox';
import { inboxPath } from '@/lib/inbox';
import { isAdmin, type Role } from '@/lib/role';
import type { Team } from '@/lib/team';

type WorkspaceSidebarProps = {
  slug: string;
  workspace: {
    readonly id: string;
    readonly name: string;
    readonly role: Role;
    readonly teams: readonly Team[];
  };
  onSearch: () => void;
};

export function WorkspaceSidebar({
  slug,
  workspace,
  onSearch,
}: WorkspaceSidebarProps) {
  const { data: waiting } = useInbox(slug);
  const unseen = waiting?.filter((each) => each.unread) ?? [];

  return (
    <>
      <div className="flex h-12 shrink-0 items-center">
        <WorkspaceMenu
          name={workspace.name}
          slug={slug}
          admin={isAdmin(workspace.role)}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="min-h-full flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-0.5">
            <SidebarSearch onOpen={onSearch} />
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
          </div>

          <TeamNav slug={slug} teams={workspace.teams} />
        </nav>
      </ScrollArea>
    </>
  );
}
