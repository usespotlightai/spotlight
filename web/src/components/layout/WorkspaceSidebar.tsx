import { Server } from 'lucide-react';
import { SidebarLink } from '@/components/layout/SidebarLink';
import { TeamNav } from '@/components/layout/TeamNav';
import { WorkspaceMenu } from '@/components/layout/WorkspaceMenu';
import { runnersPath } from '@/lib/runner';
import type { Team } from '@/lib/team';

type WorkspaceSidebarProps = {
  workspace: {
    readonly name: string;
    readonly slug: string;
    readonly teams: readonly Team[];
  };
};

export function WorkspaceSidebar({ workspace }: WorkspaceSidebarProps) {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center">
        <WorkspaceMenu name={workspace.name} slug={workspace.slug} />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2">
        <TeamNav slug={workspace.slug} teams={workspace.teams} />

        <SidebarLink to={runnersPath(workspace.slug)} icon={Server}>
          Runners
        </SidebarLink>
      </nav>
    </>
  );
}
