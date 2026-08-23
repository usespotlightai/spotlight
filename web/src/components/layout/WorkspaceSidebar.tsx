import { TeamNav } from '@/components/layout/TeamNav';
import { WorkspaceMenu } from '@/components/layout/WorkspaceMenu';
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

      <nav className="min-h-0 flex-1 overflow-y-auto pt-2">
        <TeamNav slug={workspace.slug} teams={workspace.teams} />
      </nav>
    </>
  );
}
