import { UserPlus } from 'lucide-react';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAddTeamMember } from '@/hooks/api/useAddTeamMember';
import { useWorkspaceMembers } from '@/hooks/api/useWorkspaceMembers';
import { failed, loading } from '@/lib/query';

type AddTeamMemberProps = {
  slug: string | undefined;
  teamId: string | undefined;
  onInvite: () => void;
};

export function AddTeamMember({ slug, teamId, onInvite }: AddTeamMemberProps) {
  const members = useWorkspaceMembers(slug);
  const add = useAddTeamMember(slug, teamId);
  const addable = (members.data ?? []).filter(
    (member) => !member.teams.some((team) => team.id === teamId),
  );

  return (
    <ActionWithAlert
      alert={add.isError ? 'Sorry, the member couldn’t be added.' : null}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!teamId || add.isPending}
          render={
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-border bg-card px-3 shadow-none"
            />
          }
        >
          {add.isPending ? 'Adding…' : 'Add a member'}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={6} className="min-w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground">
              In the workspace
            </DropdownMenuLabel>

            {loading(members) && (
              <p className="px-2 py-1.5 text-muted-foreground text-sm">
                Loading the workspace’s members…
              </p>
            )}

            {failed(members) && (
              <p className="px-2 py-1.5 text-muted-foreground text-sm">
                Workspace members could not be loaded.
              </p>
            )}

            {members.data && addable.length === 0 && (
              <p className="px-2 py-1.5 text-muted-foreground text-sm">
                Everyone in the workspace is on this team.
              </p>
            )}

            {addable.map((member) => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => {
                  add.reset();
                  add.mutate(member.id);
                }}
              >
                <span aria-hidden className="flex">
                  <PersonAvatar person={member} />
                </span>
                <span className="truncate">{member.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onInvite}>
            <UserPlus aria-hidden />
            Invite someone new
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ActionWithAlert>
  );
}
