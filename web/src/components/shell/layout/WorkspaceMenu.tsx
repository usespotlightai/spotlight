import { ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { InitialAvatar } from '@/components/shared/avatar/InitialAvatar';
import { DownloadTerraformItem } from '@/components/shell/layout/DownloadTerraformItem';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/hooks/api/useSession';
import { useSignOut } from '@/hooks/api/useSignOut';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';
import { workspacePath } from '@/lib/workspace';

type WorkspaceMenuProps = {
  id: string;
  name: string;
  slug: string;
};

export function WorkspaceMenu({ id, name, slug }: WorkspaceMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data: session } = useSession();
  const { data: workspaces } = useWorkspaces();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-border/50 data-[popup-open]:bg-border/50">
        <InitialAvatar
          name={name}
          className="bg-primary text-primary-foreground!"
        />
        <span className="truncate font-medium text-foreground text-sm">
          {name}
        </span>
        <ChevronsUpDown
          className="ml-auto size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate text-muted-foreground">
            {session?.user?.email}
          </DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={slug}
            onValueChange={(next) => {
              if (next !== slug) {
                void navigate(workspacePath(String(next)));
              }
            }}
          >
            {workspaces?.map((workspace) => (
              <DropdownMenuRadioItem key={workspace.id} value={workspace.slug}>
                <InitialAvatar
                  name={workspace.name}
                  className="bg-primary text-primary-foreground!"
                />
                <span className="truncate">{workspace.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          closeOnClick
          render={
            <a href="/workspaces/new" target="_blank" rel="noopener">
              Create or join a workspace
            </a>
          }
        />

        <DropdownMenuSeparator />

        <DownloadTerraformItem
          workspaceId={id}
          slug={slug}
          onDownloaded={() => setOpen(false)}
        />

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => signOut.mutate()}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
