import { ChevronsUpDown } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

function WorkspaceAvatar({ name }: { name: string }) {
  const [initial] = [...name.trim()];

  return (
    <Avatar size="sm" className="rounded after:rounded">
      <AvatarFallback className="rounded bg-primary text-[0.625rem] text-primary-foreground! uppercase">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

type WorkspaceMenuProps = {
  name: string;
  slug: string;
};

export function WorkspaceMenu({ name, slug }: WorkspaceMenuProps) {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data: session } = useSession();
  const { data: workspaces } = useWorkspaces();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent">
        <WorkspaceAvatar name={name} />
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
                <WorkspaceAvatar name={workspace.name} />
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

        <DropdownMenuItem onClick={() => signOut.mutate()}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
