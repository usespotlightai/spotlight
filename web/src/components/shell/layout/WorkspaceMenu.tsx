import { ChevronsUpDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { InitialAvatar } from '@/components/shared/avatar/InitialAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/hooks/api/useSession';
import { useSignOut } from '@/hooks/api/useSignOut';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';
import { membersPath } from '@/lib/members';
import { settingsPath } from '@/lib/settings';
import { workspacePath } from '@/lib/workspace';

type WorkspaceMenuProps = {
  name: string;
  slug: string;
  admin?: boolean;
  noneAnswering?: boolean;
};

export function WorkspaceMenu({
  name,
  slug,
  admin = false,
  noneAnswering = false,
}: WorkspaceMenuProps) {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data: session } = useSession();
  const { data: workspaces } = useWorkspaces();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-border/50 data-[popup-open]:bg-border/50">
        <InitialAvatar
          name={name}
          className="bg-primary text-primary-foreground!"
        />
        <span className="truncate font-medium text-foreground text-sm">
          {name}
        </span>
        {noneAnswering && <NoHostAnswering />}
        <ChevronsUpDown
          className="ml-auto size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-56">
        <DropdownMenuItem
          closeOnClick
          render={
            <Link to={settingsPath(slug)}>
              Settings
              {noneAnswering && (
                <span className="ml-auto">
                  <NoHostAnswering />
                </span>
              )}
            </Link>
          }
        />

        {admin && (
          <DropdownMenuItem
            closeOnClick
            render={
              <Link to={membersPath(slug)}>Invite and manage members</Link>
            }
          />
        )}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Switch workspace</DropdownMenuSubTrigger>

          <DropdownMenuSubContent className="min-w-60">
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
                  <DropdownMenuRadioItem
                    key={workspace.id}
                    value={workspace.slug}
                  >
                    <InitialAvatar
                      name={workspace.name}
                      className="bg-primary text-primary-foreground!"
                    />
                    <span className="truncate">{workspace.name}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>

            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground">
                Account
              </DropdownMenuLabel>

              <DropdownMenuItem
                closeOnClick
                render={
                  <a href="/workspaces/new" target="_blank" rel="noopener">
                    Create or join a workspace…
                  </a>
                }
              />
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onClick={() => signOut.mutate()}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoHostAnswering() {
  return (
    <span
      role="img"
      aria-label="No host is answering"
      className="block size-1.5 shrink-0 rounded-full bg-destructive"
    />
  );
}
